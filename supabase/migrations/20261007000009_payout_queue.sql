-- Deadlock fix (found by the concurrency test after 20261007000008):
-- an upsert locks the existing entry row before its row triggers run, so a per-partner-month lock taken
-- later could form a cycle with another save that already held it. Instead, every change that affects
-- payouts queues on one lock *before* touching any row. Saves are short, so the queue is invisible
-- at a handful of staff, and no cycle is possible.

create or replace function lock_partner_month(p_franchisee uuid, p_month date) returns void
language sql as $$
  select pg_advisory_xact_lock(hashtextextended('payouts', 0))
$$;

create function payout_queue() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('payouts', 0));
  return null;
end $$;

-- Statement-level BEFORE triggers fire before any row is read or locked.
create trigger queue before insert or update or delete on daily_entries for each statement execute function payout_queue();
create trigger queue before insert or update or delete on customer_capital for each statement execute function payout_queue();
create trigger queue before update on customers for each statement execute function payout_queue();
