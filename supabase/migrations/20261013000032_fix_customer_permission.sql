-- Security fix (found by the guards test): these functions checked
--   if v_customer is null or not (v_customer = my_customer_id() or can_see_customer(v_customer)) then raise ...
-- For anyone who isn't a customer, my_customer_id() is null, so the test was null and the refusal never fired:
-- a partner could request or cancel withdrawals and emergency exits for another partner's customer, and see their
-- emergency figures. can_act_for() never returns null; every such check now uses it.
create function can_act_for(p_customer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_customer is not null and (coalesce(p_customer = my_customer_id(), false) or coalesce(can_see_customer(p_customer), false))
$$;
revoke execute on function can_act_for(uuid) from public, anon;
grant execute on function can_act_for(uuid) to authenticated;

create or replace function request_withdrawal(p_amount numeric, p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if not can_act_for(v_customer) then
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

create or replace function cancel_withdrawal(p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if not can_act_for(v_customer) then
    raise exception 'You cannot change this account';
  end if;
  update withdrawal_requests set status = 'cancelled' where customer_id = v_customer and status = 'open';
end $$;

create or replace function emergency_figures(p_customer uuid default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_customer uuid := coalesce(p_customer, my_customer_id());
  c customers;
  m date := date_trunc('month', today_ist())::date;
  v_through date; v_result numeric; v_carried numeric; v_capital numeric;
begin
  select * into c from customers where id = v_customer;
  if not found or not can_act_for(v_customer) then
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

create or replace function request_emergency_exit(p_reason text default null, p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if not can_act_for(v_customer) then
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

create or replace function cancel_emergency_exit(p_customer uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(p_customer, my_customer_id());
begin
  if not can_act_for(v_customer) then
    raise exception 'You cannot change this account';
  end if;
  update emergency_exits set status = 'cancelled' where customer_id = v_customer and status = 'requested';
end $$;

