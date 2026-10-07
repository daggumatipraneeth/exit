-- Performance at scale (tested with 50 partners x 100 customers).

-- 1. Recalculate once per partner-month per save, not once per row.
--    A month's CSV backfill for 50 partners went from ~60s (past the API's 8s limit) to a few seconds.
drop trigger recompute on daily_entries;
drop function daily_entry_recompute();

create function daily_entries_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  -- Only the branch for this statement's operation runs, so each references a transition table that exists.
  if tg_op = 'INSERT' then
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m from new_rows loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  elsif tg_op = 'DELETE' then
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m from old_rows loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  else
    for r in select distinct franchisee_id, date_trunc('month', trade_date)::date as m
               from (select franchisee_id, trade_date from new_rows union select franchisee_id, trade_date from old_rows) x loop
      perform recompute_month(r.franchisee_id, r.m);
    end loop;
  end if;
  return null;
end $$;

create trigger recompute_insert after insert on daily_entries
  referencing new table as new_rows for each statement execute function daily_entries_recompute();
create trigger recompute_update after update on daily_entries
  referencing old table as old_rows new table as new_rows for each statement execute function daily_entries_recompute();
create trigger recompute_delete after delete on daily_entries
  referencing old table as old_rows for each statement execute function daily_entries_recompute();

-- 2. Month progress filtered by month uses an index instead of scanning every customer-day ever recorded.
alter table customer_days add column month date generated always as (trade_date - (extract(day from trade_date)::int - 1)) stored;
create index on customer_days (month, customer_id, trade_date desc);

create or replace view customer_month_progress with (security_invoker = true) as
select customer_id, franchisee_id, month,
       max(cap) as cap,
       (array_agg(covered order by trade_date desc))[1] as covered,
       sum(credited) as credited
from customer_days
group by customer_id, franchisee_id, month;

-- 3. Month totals for the Months page, added up in the database (a handful of rows instead of every partner-day).
--    Reads daily_entries, so only Exit staff get rows.
create view month_totals with (security_invoker = true) as
select date_trunc('month', d.trade_date)::date as month,
       count(distinct d.trade_date)::int as trading_days,
       sum(d.to_customers) as to_customers,
       sum(d.partner_income) as partner_income,
       sum(d.exit_share + case when e.amount > 0 then e.amount - d.net else 0 end) as exit_earned
from franchisee_days d
join daily_entries e using (franchisee_id, trade_date)
group by 1;
