-- check_books(): every rule the money must obey, as one query. Returns one row per problem; no rows = books balance.
-- Used by the tests and the fuzz harness, and safe to run on live data at any time (read-only).
create function check_books() returns table (rule text, detail text)
language sql stable security definer set search_path = public as $$
  -- A partner-day's customer credits add up to what the partner-day says went to customers.
  select 'customer credits = partner-day to_customers', f.franchisee_id || ' ' || f.trade_date
  from franchisee_days f
  where f.to_customers <> coalesce((select sum(d.credited) from customer_days d
                                     where d.franchisee_id = f.franchisee_id and d.trade_date = f.trade_date), 0)
  union all
  -- Profit days: everything goes to customers or overflows. Loss days: customers take all of it (if any are in).
  select 'profit day: net = to customers + overflow', f.franchisee_id || ' ' || f.trade_date
  from franchisee_days f where f.net >= 0 and f.net <> f.to_customers + f.overflow
  union all
  select 'loss day: customers take the loss, nothing overflows', f.franchisee_id || ' ' || f.trade_date
  from franchisee_days f where f.net < 0 and (f.overflow <> 0 or (f.customers > 0 and f.to_customers <> f.net))
  union all
  select 'overflow = partner + Exit', f.franchisee_id || ' ' || f.trade_date
  from franchisee_days f where f.overflow <> f.partner_income + f.exit_share or f.overflow < 0 or f.partner_income < 0
  union all
  -- Nobody is credited profit beyond their bucket.
  select 'no profit beyond the bucket', d.customer_id || ' ' || d.trade_date
  from customer_days d where d.credited > 0 and d.covered > d.cap
  union all
  -- The running bucket level is the sum of the month's credits so far.
  select 'covered = credits so far this month', d.customer_id || ' ' || d.trade_date
  from customer_days d
  where d.covered <> (select sum(x.credited) from customer_days x where x.customer_id = d.customer_id
                        and x.trade_date >= date_trunc('month', d.trade_date) and x.trade_date <= d.trade_date)
  union all
  -- Capital never below zero on any day.
  select 'capital never below zero', r.customer_id || ' ' || r.effective_from
  from (select customer_id, effective_from, sum(sum(amount)) over (partition by customer_id order by effective_from) as running
          from capital_movements group by customer_id, effective_from) r
  where r.running < 0
  union all
  -- Settlements: the payout is profit plus withdrawal; nothing negative; a loss is carried, never paid.
  select 'settlement adds up', s.customer_id || ' ' || s.month
  from settlements s
  where s.payout_total <> s.profit_payout + s.withdrawal or s.profit_payout < 0 or s.withdrawal < 0
     or s.carried_out > 0 or s.carried_in > 0
     or (s.plan = 'variable' and not s.full_exit and s.profit_payout + s.carried_out <> s.carried_in + s.result)
     or (s.full_exit and s.carried_out <> 0)
  union all
  -- A month's settlement uses exactly that month's credits (nothing changed after the close).
  select 'settlement result = the month''s credits', s.customer_id || ' ' || s.month
  from settlements s
  where s.result <> coalesce((select sum(d.credited) from customer_days d where d.customer_id = s.customer_id
                               and d.trade_date >= s.month and d.trade_date < (s.month + interval '1 month')::date), 0)
  union all
  -- Emergency exits pay exactly the formula, and the result is the credits up to `through`.
  select 'emergency payout = formula', x.customer_id::text
  from emergency_exits x
  where x.status = 'processed' and (
        x.payout <> case when x.plan = 'fixed' then x.capital else greatest(x.capital + x.carried_in + x.result, 0) end
     or x.result <> coalesce((select sum(d.credited) from customer_days d where d.customer_id = x.customer_id
                                and d.trade_date >= x.month and d.trade_date <= x.through), 0))
  union all
  -- Nobody is paid twice for a month: an emergency exit and a month settlement exclude each other.
  select 'paid once per month', x.customer_id || ' ' || x.month
  from emergency_exits x join settlements s on s.customer_id = x.customer_id and s.month = x.month
  where x.status = 'processed'
  union all
  -- After an emergency exit the customer has no capital left.
  select 'exited customers hold no capital', x.customer_id::text
  from emergency_exits x where x.status = 'processed' and total_capital(x.customer_id) <> 0
$$;
revoke execute on function check_books() from public, anon;
grant execute on function check_books() to authenticated;
