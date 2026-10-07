-- Admins can remove a login (e.g. one created with a typo). Records that person created stay;
-- only the link to who made them is cleared. The activity log keeps their name.

alter table customers drop constraint customers_created_by_fkey,
  add constraint customers_created_by_fkey foreign key (created_by) references auth.users on delete set null;
alter table daily_entries drop constraint daily_entries_entered_by_fkey,
  add constraint daily_entries_entered_by_fkey foreign key (entered_by) references auth.users on delete set null;
alter table closed_months drop constraint closed_months_closed_by_fkey,
  add constraint closed_months_closed_by_fkey foreign key (closed_by) references auth.users on delete set null;

-- Clearing entered_by after a login is removed must work even in closed months, and isn't a new save.
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

-- A partner added by mistake can be deleted, but only while it has no customers and no results.
create function partner_deletable(p_franchisee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from customers where franchisee_id = p_franchisee)
     and not exists (select 1 from daily_entries where franchisee_id = p_franchisee)
$$;
revoke execute on function partner_deletable(uuid) from public, anon;
grant execute on function partner_deletable(uuid) to authenticated;
