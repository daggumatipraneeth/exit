-- The money waterfall. All payout maths lives here, never in the browser.
--
-- Per customer per day:
--   pnl      = gross_pnl - broker_charges - other_charges
--   exit_cut = Exit's % of pnl, only on profit
--   net      = pnl - exit_cut
-- Per calendar month (resets on the 1st), days in order:
--   covered += net; anything above cap goes to the franchisee and covered stays at cap.
--   Losses reduce covered; overflow the franchisee already earned is never clawed back.

-- Capital in force on the 1st of the month; for a customer who started mid-month,
-- their first capital entry that month.
create function capital_for_month(p_customer uuid, p_month date) returns numeric
language sql stable set search_path = public as $$
  select coalesce(
    (select amount from customer_capital
      where customer_id = p_customer and effective_from <= p_month
      order by effective_from desc limit 1),
    (select amount from customer_capital
      where customer_id = p_customer and effective_from < (p_month + interval '1 month')::date
      order by effective_from limit 1))
$$;

create function recompute_month(p_customer uuid, p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  m_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  c customers;
  v_capital numeric;
  v_cap numeric(14,2);
  v_covered numeric(14,2) := 0;
  v_prev numeric(14,2);
  v_pnl numeric(14,2);
  v_cut numeric(14,2);
  v_net numeric(14,2);
  v_over numeric(14,2);
  r daily_entries;
begin
  delete from daily_results where customer_id = p_customer and trade_date >= m and trade_date < m_end;
  if not exists (select 1 from daily_entries where customer_id = p_customer and trade_date >= m and trade_date < m_end) then
    return;
  end if;

  select * into c from customers where id = p_customer;
  v_capital := capital_for_month(p_customer, m);
  if v_capital is null then
    raise exception 'Customer % has no capital recorded for %', c.full_name, to_char(m, 'Mon YYYY');
  end if;
  v_cap := round(v_capital * c.cap_pct / 100, 2);

  for r in select * from daily_entries
            where customer_id = p_customer and trade_date >= m and trade_date < m_end
            order by trade_date loop
    v_pnl := r.gross_pnl - r.broker_charges - r.other_charges;
    v_cut := round(greatest(v_pnl, 0) * r.exit_commission_pct / 100, 2);
    v_net := v_pnl - v_cut;
    v_prev := v_covered;
    v_covered := v_covered + v_net;
    v_over := greatest(v_covered - v_cap, 0);
    v_covered := v_covered - v_over;

    insert into daily_results (customer_id, trade_date, franchisee_id, trades_count, pnl, exit_cut, net,
                               cap, covered, customer_today, franchisee_income)
    values (p_customer, r.trade_date, c.franchisee_id, r.trades_count, v_pnl, v_cut, v_net,
            v_cap, v_covered, v_covered - v_prev, v_over);
  end loop;
end $$;

-- Recompute every open (not closed) month that has entries for this customer.
create function recompute_customer(p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m date;
begin
  for m in select distinct date_trunc('month', trade_date)::date from daily_entries e
            where customer_id = p_customer
              and not exists (select 1 from closed_months cm where cm.month = date_trunc('month', e.trade_date)::date) loop
    perform recompute_month(p_customer, m);
  end loop;
end $$;

revoke execute on function recompute_month(uuid, date), recompute_customer(uuid) from public, anon, authenticated;

-- Before write on daily_entries: block closed months, require an active customer, snapshot the rate.
create function daily_entry_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' and exists (select 1 from closed_months where month = date_trunc('month', old.trade_date)::date) then
    raise exception 'Month % is closed', to_char(old.trade_date, 'Mon YYYY');
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if exists (select 1 from closed_months where month = date_trunc('month', new.trade_date)::date) then
    raise exception 'Month % is closed', to_char(new.trade_date, 'Mon YYYY');
  end if;
  if tg_op = 'INSERT' or new.customer_id <> old.customer_id then
    if not exists (select 1 from customers where id = new.customer_id and status = 'active') then
      raise exception 'Customer is not active';
    end if;
    select f.exit_commission_pct into new.exit_commission_pct
      from customers c join franchisees f on f.id = c.franchisee_id where c.id = new.customer_id;
  else
    new.exit_commission_pct := old.exit_commission_pct; -- keep the rate that applied when first entered
  end if;
  return new;
end $$;

create trigger guard before insert or update or delete on daily_entries
  for each row execute function daily_entry_guard();

create function daily_entry_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    perform recompute_month(old.customer_id, old.trade_date);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.customer_id <> old.customer_id
                            or date_trunc('month', new.trade_date) <> date_trunc('month', old.trade_date)) then
    perform recompute_month(new.customer_id, new.trade_date);
  end if;
  return null;
end $$;

create trigger recompute after insert or update or delete on daily_entries
  for each row execute function daily_entry_recompute();

-- Capital or cap % changes re-run open months.
create function customer_terms_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_customer(coalesce(new.customer_id, old.customer_id));
  return null;
end $$;

create trigger recompute after insert or update or delete on customer_capital
  for each row execute function customer_terms_changed();

create function customer_cap_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_customer(new.id);
  return null;
end $$;

create trigger recompute after update of cap_pct, franchisee_id on customers
  for each row when (old.cap_pct is distinct from new.cap_pct or old.franchisee_id is distinct from new.franchisee_id)
  execute function customer_cap_changed();

-- Dashboard views. security_invoker so row-level security of the caller applies.
create view franchisee_daily with (security_invoker = true) as
select franchisee_id, trade_date,
       count(*)::int as customers,
       sum(trades_count)::int as trades,
       sum(pnl) as pnl,
       sum(exit_cut) as exit_cut,
       sum(customer_today) as customer_total,
       sum(franchisee_income) as franchisee_income
from daily_results
group by franchisee_id, trade_date;

create view customer_month_progress with (security_invoker = true) as
select customer_id, franchisee_id,
       date_trunc('month', trade_date)::date as month,
       max(cap) as cap,
       (array_agg(covered order by trade_date desc))[1] as covered,
       sum(net) as net,
       sum(exit_cut) as exit_cut,
       sum(franchisee_income) as franchisee_income
from daily_results
group by customer_id, franchisee_id, date_trunc('month', trade_date);
