-- 1. Buckets grow with each deposit, pro rata. For customer c on day d of month m (D days in the month):
--      cap(c, d) = cap% × ( capital on the 1st
--                          + Σ deposits starting after the 1st and by d: amount × (days left from its start) / D )
--    rounded to the paisa once. Example (30-day month): ₹1,00,000 on the 1st → ₹6,000; ₹50,000 counting from
--    the 16th adds 6% × 50,000 × 15/30 = ₹1,500 → ₹7,500.
--    Each day's result is shared by each customer's capital in force that day (was: capital on the 1st).
-- 2. Emergency exit: an admin pays a customer out mid-month, at the results entered so far.
--    variable plan: capital + this month's result so far + loss carried in, never below ₹0
--    fixed plan:    capital in full, no part-month fixed payout
--    The partner's days up to then become final ("locked"), so later changes can't alter what was paid.

create type emergency_status as enum ('requested', 'processed', 'cancelled');

create table emergency_exits (
  id bigserial primary key,
  customer_id uuid not null references customers on delete restrict,
  status emergency_status not null default 'requested',
  reason text,
  requested_by uuid default auth.uid() references auth.users on delete set null,
  requested_at timestamptz not null default now(),
  processed_by uuid references auth.users on delete set null,
  processed_at timestamptz,
  month date,                 -- the month it happened in
  through date,               -- last day of results included (null: none yet that month)
  plan customer_plan,
  capital numeric(14,2),      -- all capital paid back, including deposits not yet in effect
  carried_in numeric(14,2),   -- loss carried from earlier months (≤ 0)
  result numeric(14,2),       -- this month's credited results up to `through`
  payout numeric(14,2),
  paid_at timestamptz
);
create unique index emergency_one_live on emergency_exits (customer_id) where status in ('requested', 'processed');

alter table emergency_exits enable row level security;
create policy read on emergency_exits for select to authenticated
  using (can_see_customer(customer_id) or customer_id = my_customer_id());
revoke all on emergency_exits from anon, authenticated; -- written only by the functions below
grant select on emergency_exits to authenticated;
create trigger audit after insert or update or delete on emergency_exits for each row execute function audit();

-- The last day whose results are final for this partner in that month, because of an emergency exit.
create function locked_through(p_franchisee uuid, p_month date) returns date
language sql stable security definer set search_path = public as $$
  select max(x.through) from emergency_exits x join customers c on c.id = x.customer_id
  where c.franchisee_id = p_franchisee and x.status = 'processed' and x.month = date_trunc('month', p_month)::date
$$;

create function day_cap(p_customer uuid, p_rate numeric, p_day date) returns numeric
language sql stable set search_path = public as $$
  with b as (select date_trunc('month', p_day)::date as m, (date_trunc('month', p_day) + interval '1 month')::date as m_end)
  select round(p_rate / 100 * (
           capital_on(p_customer, b.m)
           + coalesce((select sum(k.amount * (b.m_end - k.effective_from) / (b.m_end - b.m)::numeric)
                         from capital_movements k
                        where k.customer_id = p_customer and k.effective_from > b.m and k.effective_from <= p_day), 0)), 2)
  from b
$$;

-- The whole month's bucket (what a fixed-plan customer is paid).
create function month_cap(p_customer uuid, p_month date) returns numeric
language sql stable set search_path = public as $$
  select day_cap(c.id, c.cap_pct, ((date_trunc('month', p_month) + interval '1 month')::date - 1)) from customers c where c.id = p_customer
$$;

-- What a deposit received at p_received would do: when it starts and how much it adds to that month's bucket.
create function deposit_preview(p_customer uuid, p_amount numeric, p_received timestamptz) returns json
language sql stable security definer set search_path = public as $$
  with x as (select effective_date(p_received) as e, c.cap_pct from customers c where c.id = p_customer and can_see_customer(p_customer)),
       b as (select x.*, date_trunc('month', x.e)::date as m, (date_trunc('month', x.e) + interval '1 month')::date as m_end from x)
  select json_build_object(
    'effective_from', b.e,
    'days', b.m_end - b.e,
    'days_in_month', b.m_end - b.m,
    'cap_added', round(b.cap_pct / 100 * p_amount * (b.m_end - b.e) / (b.m_end - b.m)::numeric, 2))
  from b
$$;
revoke execute on function deposit_preview(uuid, numeric, timestamptz) from public, anon;
grant execute on function deposit_preview(uuid, numeric, timestamptz) to authenticated;

-- The money waterfall (the rules in 20261007000002_calc.sql), now with each day's capital and bucket.
create or replace function recompute_month_unlocked(p_franchisee uuid, p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  m_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  frozen date := locked_through(p_franchisee, p_month);
  ids uuid[]; rates numeric[]; weights numeric[]; caps numeric[];
  covered numeric[]; got numeric[]; ok boolean[]; rem numeric[];
  n int := 0;
  e daily_entries;
  v_net numeric; v_left numeric; v_total numeric; v_room numeric; v_over numeric; v_partner numeric;
  topped boolean; eligible int; cents int; i int; pick int;
begin
  -- Days up to `frozen` are final: keep them, and start after them.
  delete from franchisee_days where franchisee_id = p_franchisee and trade_date >= m and trade_date < m_end
    and (frozen is null or trade_date > frozen); -- cascades to customer_days

  -- Approved customers (still here, or left) with any capital by the end of the month.
  select array_agg(c.id order by c.id), array_agg(c.cap_pct order by c.id) into ids, rates
  from customers c
  where c.franchisee_id = p_franchisee and c.status in ('active', 'closed')
    and exists (select 1 from capital_movements k where k.customer_id = c.id and k.effective_from < m_end);
  n := coalesce(array_length(ids, 1), 0);
  covered := array_fill(0::numeric, array[greatest(n, 1)]);
  weights := array_fill(0::numeric, array[greatest(n, 1)]);
  caps := array_fill(0::numeric, array[greatest(n, 1)]);
  if frozen is not null then
    for i in 1..n loop
      covered[i] := coalesce((select sum(credited) from customer_days
                               where customer_id = ids[i] and trade_date >= m and trade_date <= frozen), 0);
    end loop;
  end if;

  for e in select * from daily_entries
            where franchisee_id = p_franchisee and trade_date >= m and trade_date < m_end
              and (frozen is null or trade_date > frozen)
            order by trade_date loop
    v_net := case when e.amount > 0 then round(e.amount * (100 - e.hidden_charge_pct) / 100, 2) else e.amount end;
    got := array_fill(0::numeric, array[greatest(n, 1)]);
    ok := array_fill(false, array[greatest(n, 1)]);
    eligible := 0;
    for i in 1..n loop
      weights[i] := capital_on(ids[i], e.trade_date);
      caps[i] := day_cap(ids[i], rates[i], e.trade_date);
      ok[i] := weights[i] > 0;
      if ok[i] then eligible := eligible + 1; end if;
    end loop;

    if v_net >= 0 then
      -- Water-fill: anyone whose share would overflow is topped up exactly; repeat with the rest.
      loop
        v_left := v_net - array_total(got);
        v_total := 0;
        for i in 1..n loop
          if ok[i] and caps[i] - covered[i] - got[i] > 0 then v_total := v_total + weights[i]; end if;
        end loop;
        exit when v_total = 0 or v_left <= 0;
        topped := false;
        for i in 1..n loop
          v_room := caps[i] - covered[i] - got[i];
          if ok[i] and v_room > 0 and v_left * weights[i] >= v_room * v_total then -- exact: no division
            got[i] := got[i] + v_room;
            topped := true;
          end if;
        end loop;
        continue when topped;
        -- Nobody overflows: split the rest by capital in whole paise. Leftover paise go to the largest
        -- remainders; ties to the larger capital, then the earlier customer. Worked in integer paise with div/mod,
        -- so remainders are exact (a rounded division can turn a true tie into a false winner).
        rem := array_fill(-1::numeric, array[greatest(n, 1)]);
        for i in 1..n loop
          if ok[i] and caps[i] - covered[i] - got[i] > 0 then
            rem[i] := mod(round(v_left * 100) * round(weights[i] * 100), round(v_total * 100));
            got[i] := got[i] + div(round(v_left * 100) * round(weights[i] * 100), round(v_total * 100)) / 100;
          end if;
        end loop;
        cents := round((v_net - array_total(got)) * 100);
        while cents > 0 loop
          pick := null;
          for i in 1..n loop
            if rem[i] >= 0 and caps[i] - covered[i] - got[i] >= 0.01
               and (pick is null or rem[i] > rem[pick] or (rem[i] = rem[pick] and weights[i] > weights[pick])) then
              pick := i;
            end if;
          end loop;
          exit when pick is null; -- no room for a paisa anywhere: it stays in the overflow
          got[pick] := got[pick] + 0.01;
          rem[pick] := -1;
          cents := cents - 1;
        end loop;
        exit;
      end loop;
      v_over := v_net - array_total(got);
    else
      -- Loss: debit every customer by that day's capital, leftover paise to the largest holders.
      v_total := 0;
      for i in 1..n loop
        if ok[i] then v_total := v_total + weights[i]; end if;
      end loop;
      if v_total > 0 then
        rem := array_fill(-1::numeric, array[greatest(n, 1)]);
        for i in 1..n loop
          if ok[i] then -- integer paise, exact: debit rounded toward zero, rem = how far short of the exact debit
            got[i] := -div(round(-v_net * 100) * round(weights[i] * 100), round(v_total * 100)) / 100;
            rem[i] := mod(round(-v_net * 100) * round(weights[i] * 100), round(v_total * 100));
          end if;
        end loop;
        cents := round((array_total(got) - v_net) * 100);
        while cents > 0 loop
          pick := null;
          for i in 1..n loop
            if rem[i] >= 0 and (pick is null or rem[i] > rem[pick] or (rem[i] = rem[pick] and weights[i] > weights[pick])) then
              pick := i;
            end if;
          end loop;
          exit when pick is null;
          got[pick] := got[pick] - 0.01;
          rem[pick] := -1;
          cents := cents - 1;
        end loop;
      end if;
      v_over := 0;
    end if;

    v_partner := round(v_over * e.profit_share_pct / 100, 2);
    insert into franchisee_days (franchisee_id, trade_date, net, to_customers, overflow, partner_income, exit_share, customers)
    values (p_franchisee, e.trade_date, v_net, array_total(got), v_over, v_partner, v_over - v_partner, eligible);

    for i in 1..n loop
      if ok[i] then
        covered[i] := covered[i] + got[i];
        insert into customer_days (customer_id, trade_date, franchisee_id, capital, cap, credited, covered)
        values (ids[i], e.trade_date, p_franchisee, weights[i], caps[i], got[i], covered[i]);
      end if;
    end loop;
  end loop;
end $$;

-- Daily entry: split a total by each partner's capital on that day, the same capital the payouts use.
create or replace function partner_capital_on(p_date date)
returns table (franchisee_id uuid, capital numeric)
language sql stable set search_path = public as $$
  select c.franchisee_id, sum(capital_on(c.id, p_date))
  from customers c
  where c.status in ('active', 'closed')
  group by c.franchisee_id
  having sum(capital_on(c.id, p_date)) > 0
$$;

-- Locked days: no new, changed or removed results, and no capital starting on them.
create or replace function daily_entry_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.entered_by is null and old.entered_by is not null
     and (new.franchisee_id, new.trade_date, new.amount) = (old.franchisee_id, old.trade_date, old.amount) then
    return new;
  end if;
  if tg_op <> 'INSERT' then
    perform pg_advisory_xact_lock_shared(month_lock_key(old.trade_date));
    if exists (select 1 from closed_months where month = date_trunc('month', old.trade_date)::date) then
      raise exception 'Month % is closed', to_char(old.trade_date, 'Mon YYYY');
    end if;
    if old.trade_date <= locked_through(old.franchisee_id, old.trade_date) then
      raise exception 'Results up to % are final because a customer took an emergency exit', to_char(locked_through(old.franchisee_id, old.trade_date), 'DD Mon YYYY');
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  perform pg_advisory_xact_lock_shared(month_lock_key(new.trade_date));
  if exists (select 1 from closed_months where month = date_trunc('month', new.trade_date)::date) then
    raise exception 'Month % is closed', to_char(new.trade_date, 'Mon YYYY');
  end if;
  if new.trade_date <= locked_through(new.franchisee_id, new.trade_date) then
    raise exception 'Results up to % are final because a customer took an emergency exit', to_char(locked_through(new.franchisee_id, new.trade_date), 'DD Mon YYYY');
  end if;
  if tg_op = 'INSERT' or new.franchisee_id <> old.franchisee_id then
    select t.hidden_charge_pct, f.profit_share_pct into new.hidden_charge_pct, new.profit_share_pct
      from franchisees f join franchisee_terms t on t.franchisee_id = f.id where f.id = new.franchisee_id;
    if new.hidden_charge_pct is null then
      raise exception 'Set this partner''s trade charges before entering results';
    end if;
  else
    new.hidden_charge_pct := old.hidden_charge_pct;
    new.profit_share_pct := old.profit_share_pct;
  end if;
  if tg_op = 'UPDATE' then
    new.entered_at := clock_timestamp();
    new.entered_by := coalesce(auth.uid(), old.entered_by);
  end if;
  return new;
end $$;

create or replace function capital_movement_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_cust customers;
  v_date date := coalesce(new.effective_from, old.effective_from);
  v_locked date;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Capital entries can''t be changed. Undo it and add it again.';
  end if;
  select franchisee_id, status into v_cust.franchisee_id, v_cust.status from customers where id = coalesce(new.customer_id, old.customer_id);
  if tg_op = 'INSERT' and new.received_at is not null then
    new.effective_from := effective_date(new.received_at);
    v_date := new.effective_from;
  end if;
  v_locked := locked_through(v_cust.franchisee_id, v_date);
  if v_date <= v_locked then
    raise exception 'Results up to % are final because a customer took an emergency exit. Record it as received after that.', to_char(v_locked, 'DD Mon YYYY');
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from closed_months where month = date_trunc('month', old.effective_from)::date) then
      raise exception '% is closed, so this can''t be undone', to_char(old.effective_from, 'Mon YYYY');
    end if;
    return old;
  end if;
  if current_user = 'authenticated' then
    if new.kind = 'deposit' and new.received_at is null then
      raise exception 'Enter when the money reached Exit';
    end if;
    if new.kind <> 'deposit' and not is_admin() then
      raise exception 'Only an Exit admin can record that';
    end if;
    if v_cust.status = 'closed' then
      raise exception 'This account is closed';
    end if;
  end if;
  return new;
end $$;

-- What an emergency exit would pay right now. The customer, their partner or staff may look.
create function emergency_figures(p_customer uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_customer uuid := coalesce(p_customer, my_customer_id());
  c customers;
  m date := date_trunc('month', today_ist())::date;
  v_through date; v_result numeric; v_carried numeric; v_capital numeric;
begin
  select * into c from customers where id = v_customer;
  if not found or not (can_see_customer(v_customer) or v_customer = my_customer_id()) then
    raise exception 'You cannot see this customer';
  end if;
  v_through := (select max(trade_date) from daily_entries
                 where franchisee_id = c.franchisee_id and trade_date >= m and trade_date <= today_ist());
  v_result := coalesce((select sum(credited) from customer_days
                         where customer_id = c.id and trade_date >= m and trade_date <= v_through), 0);
  v_carried := carried_loss(c.id);
  v_capital := total_capital(c.id);
  return json_build_object(
    'month', m, 'through', v_through, 'plan', c.plan, 'capital', v_capital, 'carried', v_carried, 'result', v_result,
    'payout', case when c.plan = 'fixed' then v_capital else greatest(v_capital + v_carried + v_result, 0) end,
    'blocked', case
      when c.status <> 'active' then 'This account is not active'
      when exists (select 1 from daily_entries e where e.trade_date < m
                     and not exists (select 1 from closed_months cm where cm.month = date_trunc('month', e.trade_date)::date))
        then 'Close earlier months first'
    end);
end $$;

-- The customer (or their partner) asks; an admin processes it.
create function request_emergency_exit(p_reason text default null, p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if v_customer is null or not (v_customer = my_customer_id() or can_see_customer(v_customer)) then
    raise exception 'You cannot change this account';
  end if;
  if not exists (select 1 from customers where id = v_customer and status = 'active') then
    raise exception 'This account is not active';
  end if;
  if exists (select 1 from emergency_exits where customer_id = v_customer and status = 'requested') then
    raise exception 'An emergency exit has already been requested';
  end if;
  insert into emergency_exits (customer_id, reason) values (v_customer, nullif(trim(p_reason), ''));
end $$;

create function cancel_emergency_exit(p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if v_customer is null or not (v_customer = my_customer_id() or can_see_customer(v_customer)) then
    raise exception 'You cannot change this account';
  end if;
  update emergency_exits set status = 'cancelled' where customer_id = v_customer and status = 'requested';
end $$;

create function process_emergency_exit(p_customer uuid) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  f json;
  v_id bigint;
  v_plan customer_plan;
begin
  if not is_admin() then raise exception 'Only an admin can process an emergency exit'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payouts', 0)); -- same queue as every other payout change
  f := emergency_figures(p_customer);
  if f->>'blocked' is not null then raise exception '%', f->>'blocked'; end if;
  select plan into v_plan from customers where id = p_customer for update;

  update emergency_exits set status = 'processed' where customer_id = p_customer and status = 'requested' returning id into v_id;
  if v_id is null then
    insert into emergency_exits (customer_id, status, reason) values (p_customer, 'processed', 'Processed by Exit') returning id into v_id;
  end if;
  -- Recorded (and so locking the partner's days through `through`) before capital changes trigger a recompute.
  update emergency_exits set processed_by = auth.uid(), processed_at = now(),
    month = (f->>'month')::date, through = (f->>'through')::date, plan = v_plan,
    capital = (f->>'capital')::numeric, carried_in = (f->>'carried')::numeric, result = (f->>'result')::numeric,
    payout = (f->>'payout')::numeric
  where id = v_id;

  -- Capital ends the day after the last result included (the 1st, if there were none this month).
  perform close_out_capital(p_customer, coalesce((f->>'through')::date + 1, (f->>'month')::date));
  update withdrawal_requests set status = 'cancelled' where customer_id = p_customer and status = 'open';
  update customers set status = 'closed' where id = p_customer;
  return (f->>'payout')::numeric;
end $$;

create function mark_emergency_paid(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can mark payouts paid'; end if;
  update emergency_exits set paid_at = now() where id = p_id and status = 'processed' and paid_at is null;
end $$;

-- The bank file for one emergency payout (same layout as payout_file).
create function emergency_payout_file(p_id bigint)
returns table (beneficiary_name text, account_number text, ifsc text, amount numeric, narration text, customer text, partner text)
language sql stable security definer set search_path = public as $$
  select c.bank_holder, pii_decrypt(c.bank_account_enc), c.bank_ifsc, x.payout,
         'Exit emergency payout ' || to_char(x.processed_at at time zone 'Asia/Kolkata', 'DD Mon YYYY'), c.full_name, f.name
  from emergency_exits x join customers c on c.id = x.customer_id join franchisees f on f.id = c.franchisee_id
  where is_staff() and x.id = p_id and x.status = 'processed' and x.payout > 0
$$;

revoke execute on function emergency_figures(uuid), request_emergency_exit(text, uuid), cancel_emergency_exit(uuid),
  process_emergency_exit(uuid), mark_emergency_paid(bigint), emergency_payout_file(bigint) from public, anon;
grant execute on function emergency_figures(uuid), request_emergency_exit(text, uuid), cancel_emergency_exit(uuid),
  process_emergency_exit(uuid), mark_emergency_paid(bigint), emergency_payout_file(bigint) to authenticated;

-- The customer's page: deposits from the ledger, pro-rated fixed payout, and the emergency exit.
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
                date_trunc('month', today_ist())::date);
  return json_build_object(
    'name', c.full_name, 'phone', c.phone, 'plan', c.plan, 'status', c.status,
    'partner', (select json_build_object('name', name, 'phone', phone) from franchisees where id = c.franchisee_id),
    'bank', json_build_object('holder', c.bank_holder, 'last4', c.bank_last4, 'ifsc', c.bank_ifsc),
    'invested', current_capital(c.id),
    'deposits', (select json_agg(json_build_object('kind', kind, 'amount', amount, 'received_at', received_at, 'date', effective_from)
                                 order by effective_from, id)
                   from capital_movements where customer_id = c.id),
    'month', m,
    'months', (select json_agg(x.mo order by x.mo desc) from (select distinct date_trunc('month', trade_date)::date mo
                 from customer_days where customer_id = c.id) x),
    'days', (select json_agg(json_build_object('date', trade_date, 'pnl', credited) order by trade_date desc)
               from customer_days where customer_id = c.id and trade_date >= m and trade_date < m + interval '1 month'),
    'month_pnl', (select coalesce(sum(credited), 0) from customer_days
                    where customer_id = c.id and trade_date >= m and trade_date < m + interval '1 month'),
    'fixed_payout', case when c.plan = 'fixed' then month_cap(c.id, m) end,
    'carried', carried_loss(c.id),
    'payouts', (select json_agg(p order by p.month desc, p.emergency) from (
                  select month, payout_total as amount, withdrawal, paid_at, false as emergency from settlements where customer_id = c.id
                  union all
                  select month, payout, capital, paid_at, true from emergency_exits where customer_id = c.id and status = 'processed') p),
    'withdrawal', (select json_build_object('amount', amount, 'requested_at', requested_at)
                     from withdrawal_requests where customer_id = c.id and status = 'open'),
    'withdrawable', withdrawable(c.id),
    'emergency', (select json_build_object('status', status, 'requested_at', requested_at, 'payout', payout, 'paid_at', paid_at)
                    from emergency_exits where customer_id = c.id and status in ('requested', 'processed')),
    'next_close', (select json_build_object('month', x.mo, 'result', coalesce(sum(d.credited), 0))
                     from (select min(date_trunc('month', trade_date))::date mo from customer_days k
                            where k.customer_id = c.id
                              and not exists (select 1 from closed_months cm where cm.month = date_trunc('month', k.trade_date))) x
                     join customer_days d on d.customer_id = c.id and d.trade_date >= x.mo and d.trade_date < x.mo + interval '1 month'
                    group by x.mo));
end $$;

-- Re-run every open month under the new rules.
do $$
declare f uuid;
begin
  for f in select id from franchisees loop
    perform recompute_partner(f);
  end loop;
end $$;
