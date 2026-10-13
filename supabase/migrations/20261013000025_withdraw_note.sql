-- A withdrawal is settled at the next month close, where that month's loss is taken off first. my_account()
-- now also returns that month's running result (next_close), so the customer can be told before asking.
create or replace function my_account(p_month date default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  c customers;
  m date;
begin
  select * into c from customers where id = my_customer_id();
  if not found then return null; end if;
  m := coalesce(date_trunc('month', p_month)::date,
                (select date_trunc('month', max(trade_date))::date from customer_days where customer_id = c.id),
                date_trunc('month', current_date)::date);
  return json_build_object(
    'name', c.full_name, 'phone', c.phone, 'plan', c.plan, 'status', c.status,
    'partner', (select json_build_object('name', name, 'phone', phone) from franchisees where id = c.franchisee_id),
    'bank', json_build_object('holder', c.bank_holder, 'last4', c.bank_last4, 'ifsc', c.bank_ifsc),
    'invested', current_capital(c.id),
    'deposits', (select json_agg(json_build_object('date', effective_from, 'amount', amount) order by effective_from)
                   from customer_capital where customer_id = c.id),
    'month', m,
    'months', (select json_agg(x.mo order by x.mo desc) from (select distinct date_trunc('month', trade_date)::date mo
                 from customer_days where customer_id = c.id) x),
    'days', (select json_agg(json_build_object('date', trade_date, 'pnl', credited) order by trade_date desc)
               from customer_days where customer_id = c.id and trade_date >= m and trade_date < m + interval '1 month'),
    'month_pnl', (select coalesce(sum(credited), 0) from customer_days
                    where customer_id = c.id and trade_date >= m and trade_date < m + interval '1 month'),
    'fixed_payout', case when c.plan = 'fixed' then round(coalesce(capital_for_month(c.id, m), 0) * c.cap_pct / 100, 2) end,
    'carried', carried_loss(c.id),
    'payouts', (select json_agg(json_build_object('month', month, 'amount', payout_total, 'withdrawal', withdrawal,
                                                  'paid_at', paid_at) order by month desc)
                  from settlements where customer_id = c.id),
    'withdrawal', (select json_build_object('amount', amount, 'requested_at', requested_at)
                     from withdrawal_requests where customer_id = c.id and status = 'open'),
    'withdrawable', withdrawable(c.id),
    'next_close', (select json_build_object('month', x.mo, 'result', coalesce(sum(d.credited), 0))
                     from (select min(date_trunc('month', trade_date))::date mo from customer_days k
                            where k.customer_id = c.id
                              and not exists (select 1 from closed_months cm where cm.month = date_trunc('month', k.trade_date))) x
                     join customer_days d on d.customer_id = c.id and d.trade_date >= x.mo and d.trade_date < x.mo + interval '1 month'
                    group by x.mo));
end $$;
