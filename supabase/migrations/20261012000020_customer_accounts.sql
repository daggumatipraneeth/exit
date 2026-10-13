-- Customer accounts: their own login, bank details, plans, withdrawals and monthly settlements.
--
-- Settlement at month close (all amounts from customer_days, which follow the payout rules in _calc.sql):
--   variable plan: balance = loss carried from earlier months + this month's result.
--                  A positive balance is paid out; a negative one is carried to next month.
--   fixed plan:    the bucket size (cap % × capital) is paid every month whatever the result; Exit absorbs the gap.
--   withdrawal:    an open request is paid with the payout, capped at capital + carried loss. Capital drops by
--                  that much from the 1st of next month; withdrawing everything closes the account.
-- Customers never read cap, cap % or cap status: my_account() is their only window.

create type customer_plan as enum ('variable', 'fixed');

alter table customers
  add column plan customer_plan not null default 'variable',
  add column bank_holder text,
  add column bank_ifsc text check (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  add column bank_account_enc bytea,
  add column bank_last4 text check (bank_last4 ~ '^[0-9]{4}$');

grant select (plan, bank_holder, bank_ifsc, bank_last4) on customers to authenticated;
grant insert (plan), update (plan) on customers to authenticated;
-- Bank columns are written only by set_customer_bank(), so the encrypted number and last 4 always match.

-- Customer logins.
alter table profiles add column customer_id uuid unique references customers;
alter table profiles drop constraint profiles_check,
  add constraint profiles_role_link check ((role = 'franchisee') = (franchisee_id is not null)
                                           and (role = 'customer') = (customer_id is not null));

create function my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from profiles where id = auth.uid()
$$;

-- Customers can't probe for PANs.
create or replace function pan_available(p_pan text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('admin', 'employee', 'franchisee'), false)
     and not exists (select 1 from customers where pan_hash = pii_hash(upper(trim(p_pan))))
$$;

-- Plan is a term like cap %: staff only.
create or replace function customer_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- server-side (service role / migrations / seed / signing RPC)
  end if;
  if not is_staff() then
    if tg_op = 'INSERT' then
      new.cap_pct := 6; -- default terms; admin adjusts on approval
      new.plan := 'variable';
    elsif new.cap_pct <> old.cap_pct or new.franchisee_id <> old.franchisee_id or new.plan <> old.plan then
      raise exception 'Only Exit staff can change customer terms';
    end if;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if not is_admin() then
      raise exception 'Only an admin can approve a customer';
    end if;
    if not exists (select 1 from agreements where customer_id = new.id and signed_at is not null) then
      raise exception 'The customer has not signed the agreement yet';
    end if;
  end if;
  return new;
end $$;

-- Bank account: money comes in from it and payouts go back to it. Same edit rule as PAN.
create function set_customer_bank(p_customer uuid, p_holder text, p_account text, p_ifsc text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_holder text := trim(coalesce(p_holder, ''));
  v_account text := regexp_replace(coalesce(p_account, ''), '\s', '', 'g');
  v_ifsc text := upper(trim(coalesce(p_ifsc, '')));
begin
  if not (is_staff() or exists (select 1 from customers where id = p_customer and franchisee_id = my_franchisee_id()
                                   and status in ('draft', 'awaiting_signature'))) then
    raise exception 'You cannot change this customer';
  end if;
  if length(v_holder) < 3 then raise exception 'Enter the account holder''s name as the bank has it'; end if;
  if v_account !~ '^[0-9]{9,18}$' then raise exception 'Account number is 9 to 18 digits'; end if;
  if v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then raise exception 'IFSC is 11 characters, like SBIN0001234'; end if;
  update customers set bank_holder = v_holder, bank_ifsc = v_ifsc,
                       bank_account_enc = pii_encrypt(v_account), bank_last4 = right(v_account, 4)
   where id = p_customer;
end $$;
revoke execute on function set_customer_bank(uuid, text, text, text) from public, anon;
grant execute on function set_customer_bank(uuid, text, text, text) to authenticated;

-- PAN, capital and bank details are required; Aadhaar and the KYC photos are optional for now.
create or replace function create_signing_link(p_customer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c customers;
  missing text[] := '{}';
  v_token uuid;
begin
  if not can_edit_kyc(p_customer) then
    raise exception 'You cannot change this customer';
  end if;
  select * into c from customers where id = p_customer;
  if c.pan_enc is null then missing := missing || 'PAN number'::text; end if;
  if not exists (select 1 from customer_capital where customer_id = p_customer) then missing := missing || 'capital'::text; end if;
  if c.bank_account_enc is null or c.bank_ifsc is null then missing := missing || 'bank details'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'Add the % first', array_to_string(missing, ', ');
  end if;
  if not exists (select 1 from agreement_templates) then
    raise exception 'Exit has not set up an agreement yet';
  end if;
  delete from agreements where customer_id = p_customer and signed_at is null;
  insert into agreements (customer_id, template_version)
  values (p_customer, (select max(version) from agreement_templates))
  returning sign_token into v_token;
  update customers set status = 'awaiting_signature' where id = p_customer;
  return v_token;
end $$;

-- Login management for a customer, called by the admin-users function as the caller (staff or the customer's partner).
create function customer_login_id(p_customer uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where customer_id = p_customer and can_see_customer(p_customer)
$$;

create function link_customer_login(p_user uuid, p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c customers;
begin
  select * into c from customers where id = p_customer;
  if not found or not can_see_customer(p_customer) then
    raise exception 'You cannot change this customer';
  end if;
  if c.status <> 'active' then
    raise exception 'Logins are for approved customers only';
  end if;
  insert into profiles (id, full_name, role, customer_id) values (p_user, c.full_name, 'customer', p_customer);
end $$;
revoke execute on function customer_login_id(uuid), link_customer_login(uuid, uuid) from public, anon;
grant execute on function customer_login_id(uuid), link_customer_login(uuid, uuid) to authenticated;

-- Withdrawals: one open request per customer, paid at the next month close.
create table withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  requested_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'settled', 'cancelled')),
  settled_month date
);
create unique index withdrawal_one_open on withdrawal_requests (customer_id) where status = 'open';

create table settlements (
  customer_id uuid not null references customers on delete cascade,
  month date not null references closed_months on delete cascade,
  plan customer_plan not null,
  invested numeric(14,2) not null,      -- net amount invested during the month
  result numeric(14,2) not null,        -- sum of the month's daily credits
  carried_in numeric(14,2) not null,    -- loss brought forward (≤ 0)
  profit_payout numeric(14,2) not null,
  withdrawal numeric(14,2) not null,
  full_exit boolean not null,
  payout_total numeric(14,2) not null,  -- what the bank file pays
  carried_out numeric(14,2) not null,   -- loss carried to next month (≤ 0)
  paid_at timestamptz,
  primary key (customer_id, month)
);

alter table withdrawal_requests enable row level security;
alter table settlements enable row level security;
create policy read on withdrawal_requests for select to authenticated
  using (can_see_customer(customer_id) or customer_id = my_customer_id());
create policy read on settlements for select to authenticated
  using (can_see_customer(customer_id) or customer_id = my_customer_id());

do $$
declare t text;
begin
  foreach t in array array['withdrawal_requests', 'settlements'] loop
    execute format('create trigger audit after insert or update or delete on %I for each row execute function audit()', t);
  end loop;
end $$;

-- Months are closed and reopened through close_month() / reopen_month() only, so settlements always match.
drop policy admin_write on closed_months;

-- Capital in force now, and the loss carried from the last closed month.
create function current_capital(p_customer uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select amount from customer_capital where customer_id = p_customer and effective_from <= current_date
                    order by effective_from desc limit 1), 0)
$$;
create function carried_loss(p_customer uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce((select carried_out from settlements where customer_id = p_customer order by month desc limit 1), 0)
$$;

-- What a withdrawal can ask for: capital less any loss still carried.
create function withdrawable(p_customer uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(current_capital(p_customer) + carried_loss(p_customer), 0)
  where can_see_customer(p_customer) or p_customer = my_customer_id()
$$;

create function request_withdrawal(p_amount numeric, p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if v_customer is null or not (v_customer = my_customer_id() or can_see_customer(v_customer)) then
    raise exception 'You cannot change this account';
  end if;
  if not exists (select 1 from customers where id = v_customer and status = 'active') then
    raise exception 'This account is not active';
  end if;
  if exists (select 1 from withdrawal_requests where customer_id = v_customer and status = 'open') then
    raise exception 'There is already a withdrawal request. Cancel it first to change the amount.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount';
  end if;
  if round(p_amount, 2) > withdrawable(v_customer) then
    raise exception 'You can withdraw up to ₹%', to_char(withdrawable(v_customer), 'FM99,99,99,99,990.00');
  end if;
  insert into withdrawal_requests (customer_id, amount) values (v_customer, round(p_amount, 2));
end $$;

create function cancel_withdrawal(p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if v_customer is null or not (v_customer = my_customer_id() or can_see_customer(v_customer)) then
    raise exception 'You cannot change this account';
  end if;
  update withdrawal_requests set status = 'cancelled' where customer_id = v_customer and status = 'open';
end $$;

create function close_month(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  nxt date := (date_trunc('month', p_month) + interval '1 month')::date;
  r record; w withdrawal_requests;
  v_carried numeric; v_profit numeric; v_out numeric; v_now numeric; v_avail numeric; v_w numeric; v_full boolean;
begin
  if not is_admin() then raise exception 'Only an admin can close a month'; end if;
  if nxt > current_date then raise exception 'A month can be closed once it has ended'; end if;
  if exists (select 1 from closed_months where month = m) then raise exception '% is already closed', to_char(m, 'Mon YYYY'); end if;
  if exists (select 1 from daily_entries e where e.trade_date < m
               and not exists (select 1 from closed_months c where c.month = date_trunc('month', e.trade_date)::date)) then
    raise exception 'Close earlier months first';
  end if;
  insert into closed_months (month) values (m);

  for r in
    select c.id, c.plan, coalesce(capital_for_month(c.id, m), 0) as invested,
           coalesce(sum(d.credited), 0) as result, coalesce(max(d.cap), 0) as cap
    from customers c
    left join customer_days d on d.customer_id = c.id and d.trade_date >= m and d.trade_date < nxt
    where c.status = 'active' or d.customer_id is not null
    group by c.id
    having coalesce(capital_for_month(c.id, m), 0) > 0 or count(d.customer_id) > 0
  loop
    v_carried := carried_loss(r.id);
    if r.plan = 'fixed' then
      v_profit := r.cap;
      v_out := 0;
    else
      v_profit := greatest(v_carried + r.result, 0);
      v_out := least(v_carried + r.result, 0);
    end if;

    v_w := 0; v_full := false;
    select * into w from withdrawal_requests where customer_id = r.id and status = 'open' for update;
    if found then
      v_now := coalesce((select amount from customer_capital where customer_id = r.id and effective_from <= nxt
                          order by effective_from desc limit 1), 0);
      v_avail := greatest(v_now + v_out, 0);
      v_w := least(w.amount, v_avail);
      v_full := v_w >= v_avail;
      if v_full then
        v_out := 0; -- a carried loss is settled by paying out what's left
        update customers set status = 'closed' where id = r.id;
      else
        insert into customer_capital (customer_id, effective_from, amount) values (r.id, nxt, v_now - v_w)
        on conflict (customer_id, effective_from) do update set amount = excluded.amount;
      end if;
      update withdrawal_requests set status = 'settled', settled_month = m where id = w.id;
    end if;

    insert into settlements (customer_id, month, plan, invested, result, carried_in, profit_payout,
                             withdrawal, full_exit, payout_total, carried_out)
    values (r.id, m, r.plan, r.invested, r.result, v_carried, v_profit, v_w, v_full, v_profit + v_w, v_out);
  end loop;
end $$;

-- Undo a close while nothing has been paid: restores withdrawals and capital, then reopens.
create function reopen_month(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  nxt date := (date_trunc('month', p_month) + interval '1 month')::date;
  st settlements;
begin
  if not is_admin() then raise exception 'Only an admin can reopen a month'; end if;
  if not exists (select 1 from closed_months where month = m) then raise exception '% is not closed', to_char(m, 'Mon YYYY'); end if;
  if exists (select 1 from closed_months where month > m) then raise exception 'Reopen later months first'; end if;
  if exists (select 1 from settlements where month = m and paid_at is not null) then
    raise exception '% is already paid, so it can''t be reopened', to_char(m, 'Mon YYYY');
  end if;
  if exists (select 1 from withdrawal_requests o join withdrawal_requests s on s.customer_id = o.customer_id
              where o.status = 'open' and s.status = 'settled' and s.settled_month = m) then
    raise exception 'A customer settled this month has a new withdrawal request. Cancel it first.';
  end if;

  for st in select * from settlements where month = m and withdrawal > 0 loop
    if st.full_exit then
      update customers set status = 'active' where id = st.customer_id;
    else
      update customer_capital set amount = amount + st.withdrawal where customer_id = st.customer_id and effective_from = nxt;
    end if;
  end loop;
  update withdrawal_requests set status = 'open', settled_month = null where status = 'settled' and settled_month = m;
  delete from closed_months where month = m; -- cascades to settlements
end $$;

create function mark_paid(p_month date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can mark payouts paid'; end if;
  update settlements set paid_at = now() where month = date_trunc('month', p_month)::date and paid_at is null;
end $$;

-- The bank's bulk-payment file (generic layout until the bank's own template is known).
create function payout_file(p_month date)
returns table (beneficiary_name text, account_number text, ifsc text, amount numeric, narration text, customer text, partner text)
language sql stable security definer set search_path = public as $$
  select c.bank_holder, pii_decrypt(c.bank_account_enc), c.bank_ifsc, s.payout_total,
         'Exit payout ' || to_char(s.month, 'Mon YYYY'), c.full_name, f.name
  from settlements s join customers c on c.id = s.customer_id join franchisees f on f.id = c.franchisee_id
  where is_staff() and s.month = date_trunc('month', p_month)::date and s.payout_total > 0
  order by f.name, c.full_name
$$;

-- The customer's own page. Never returns cap, cap % or bucket levels, or whether the cap is reached.
create function my_account(p_month date default null) returns json
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
    'withdrawable', withdrawable(c.id));
end $$;

revoke execute on function current_capital(uuid), carried_loss(uuid), withdrawable(uuid), request_withdrawal(numeric, uuid),
  cancel_withdrawal(uuid), close_month(date), reopen_month(date), mark_paid(date), payout_file(date), my_account(date)
  from public, anon;
grant execute on function withdrawable(uuid), request_withdrawal(numeric, uuid), cancel_withdrawal(uuid), close_month(date),
  reopen_month(date), mark_paid(date), payout_file(date), my_account(date) to authenticated;
