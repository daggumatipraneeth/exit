-- Several people at once. Found by firing simultaneous saves at the API:
--   * two saves recalculating the same partner-month collided (duplicate key) or deadlocked;
--   * a save could land in a month being closed at that same moment.

-- 1. One recalculation per partner-month at a time; others queue behind it (held until commit).
create or replace function lock_partner_month(p_franchisee uuid, p_month date) returns void
language sql as $$
  select pg_advisory_xact_lock(hashtextextended('recompute:' || p_franchisee || ':' || date_trunc('month', p_month)::date, 0))
$$;

-- Wrap recompute_month with the lock (the body is unchanged; renamed to recompute_month_unlocked).
alter function recompute_month(uuid, date) rename to recompute_month_unlocked;
create function recompute_month(p_franchisee uuid, p_month date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform lock_partner_month(p_franchisee, p_month);
  perform recompute_month_unlocked(p_franchisee, p_month);
end $$;
revoke execute on function recompute_month(uuid, date), recompute_month_unlocked(uuid, date), lock_partner_month(uuid, date) from public, anon, authenticated;

-- Statement trigger: lock partner-months in a fixed order so two multi-partner saves can't deadlock.
create or replace function daily_entries_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m from new_rows order by 1, 2 loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  elsif tg_op = 'DELETE' then
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m from old_rows order by 1, 2 loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  else
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m
               from (select franchisee_id, trade_date from new_rows union select franchisee_id, trade_date from old_rows) x order by 1, 2 loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  end if;
  return null;
end $$;

-- 2. Closing (or reopening) a month waits for saves already in progress in that month;
--    saves arriving meanwhile wait for the close, then see the month as closed.
create function month_lock_key(p_month date) returns bigint
language sql immutable as $$ select hashtextextended('month:' || date_trunc('month', p_month)::date, 0) $$;

create function closed_months_lock() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(month_lock_key(coalesce(new.month, old.month)));
  return coalesce(new, old);
end $$;
create trigger lock_month before insert or update or delete on closed_months
  for each row execute function closed_months_lock();

-- 3. Saves take a shared lock on their month before checking it's open, and stamp who/when on every change
--    (the daily entry screen uses entered_at to spot someone else's save).
create or replace function daily_entry_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    perform pg_advisory_xact_lock_shared(month_lock_key(old.trade_date));
    if exists (select 1 from closed_months where month = date_trunc('month', old.trade_date)::date) then
      raise exception 'Month % is closed', to_char(old.trade_date, 'Mon YYYY');
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  perform pg_advisory_xact_lock_shared(month_lock_key(new.trade_date));
  if exists (select 1 from closed_months where month = date_trunc('month', new.trade_date)::date) then
    raise exception 'Month % is closed', to_char(new.trade_date, 'Mon YYYY');
  end if;
  if tg_op = 'INSERT' or new.franchisee_id <> old.franchisee_id then
    select t.hidden_charge_pct, f.profit_share_pct into new.hidden_charge_pct, new.profit_share_pct
      from franchisees f join franchisee_terms t on t.franchisee_id = f.id where f.id = new.franchisee_id;
    if new.hidden_charge_pct is null then
      raise exception 'Set this partner''s hidden charge before entering results';
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
