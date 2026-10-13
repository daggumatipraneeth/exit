-- Month close, rewritten for the capital ledger, pro-rated buckets and emergency exits.
-- * A month can be closed from its last day (IST), by an admin or by the automatic job.
-- * The job runs every day at 23:30 IST and closes the month only on its last day, only if nobody closed it
--   by hand already, and only once every earlier month is closed.
-- * Buckets don't depend on closing: they start fresh every 1st in the calculation itself.
--
-- Settlement per customer (unchanged rules):
--   variable: payout = max(carried + result, 0); carried_out = min(carried + result, 0)
--   fixed:    payout = the month's (pro-rated) bucket; nothing carried
--   withdrawal: capped at capital on the 1st of next month + carried loss. Asking for all of it (or more) is a
--   full exit: everything is paid back, including a deposit received but not yet in effect, and the account closes.
-- Customers who took an emergency exit during the month were already paid and are left out.

create or replace function close_month(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  nxt date := (date_trunc('month', p_month) + interval '1 month')::date;
  r record; w withdrawal_requests;
  v_carried numeric; v_profit numeric; v_out numeric; v_avail numeric; v_w numeric; v_full boolean;
begin
  if not (is_admin() or auth.uid() is null) then raise exception 'Only an admin can close a month'; end if;
  if today_ist() < nxt - 1 then raise exception 'A month can be closed from its last day'; end if;
  if exists (select 1 from closed_months where month = m) then raise exception '% is already closed', to_char(m, 'Mon YYYY'); end if;
  if exists (select 1 from daily_entries e where e.trade_date < m
               and not exists (select 1 from closed_months c where c.month = date_trunc('month', e.trade_date)::date)) then
    raise exception 'Close earlier months first';
  end if;
  insert into closed_months (month) values (m);

  for r in
    select c.id, c.plan, coalesce(capital_for_month(c.id, m), 0) as invested, coalesce(sum(d.credited), 0) as result
    from customers c
    left join customer_days d on d.customer_id = c.id and d.trade_date >= m and d.trade_date < nxt
    where (c.status = 'active' or d.customer_id is not null)
      and not exists (select 1 from emergency_exits x where x.customer_id = c.id and x.status = 'processed' and x.month = m)
    group by c.id
    having coalesce(capital_for_month(c.id, m), 0) > 0 or count(d.customer_id) > 0
  loop
    v_carried := carried_loss(r.id);
    if r.plan = 'fixed' then
      v_profit := month_cap(r.id, m);
      v_out := 0;
    else
      v_profit := greatest(v_carried + r.result, 0);
      v_out := least(v_carried + r.result, 0);
    end if;

    v_w := 0; v_full := false;
    select * into w from withdrawal_requests where customer_id = r.id and status = 'open' for update;
    if found then
      v_avail := greatest(capital_on(r.id, nxt) + v_out, 0);
      v_w := least(w.amount, v_avail);
      v_full := v_w >= v_avail;
      if v_full then
        v_w := greatest(total_capital(r.id) + v_out, 0); -- includes a deposit not yet in effect
        perform close_out_capital(r.id, nxt, m);
        v_out := 0; -- a carried loss is settled by paying out what's left
        update customers set status = 'closed' where id = r.id;
      elsif v_w > 0 then
        insert into capital_movements (customer_id, kind, amount, effective_from, settled_month)
        values (r.id, 'withdrawal', -v_w, nxt, m);
      end if;
      update withdrawal_requests set status = 'settled', settled_month = m where id = w.id;
    end if;

    insert into settlements (customer_id, month, plan, invested, result, carried_in, profit_payout,
                             withdrawal, full_exit, payout_total, carried_out)
    values (r.id, m, r.plan, r.invested, r.result, v_carried, v_profit, v_w, v_full, v_profit + v_w, v_out);
  end loop;
end $$;

-- Undo a close while nothing has been paid: removes the capital the close took out, restores withdrawals.
create or replace function reopen_month(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
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
  if exists (select 1 from emergency_exits where status = 'processed' and month > m) then
    raise exception 'An emergency exit was paid after this month, so it can''t be reopened';
  end if;

  delete from capital_movements where settled_month = m;
  update customers set status = 'active' where id in (select customer_id from settlements where month = m and full_exit);
  update withdrawal_requests set status = 'open', settled_month = null where status = 'settled' and settled_month = m;
  delete from closed_months where month = m; -- cascades to settlements
end $$;

-- The scheduled close. Returns what it did, for the job log.
create function auto_close_month(p_today date default today_ist()) returns text
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_today)::date;
begin
  if p_today <> (m + interval '1 month')::date - 1 then return 'not the last day'; end if;
  if exists (select 1 from closed_months where month = m) then return 'already closed'; end if;
  if exists (select 1 from daily_entries e where e.trade_date < m
               and not exists (select 1 from closed_months c where c.month = date_trunc('month', e.trade_date)::date)) then
    return 'an earlier month is still open';
  end if;
  perform close_month(m);
  return 'closed ' || to_char(m, 'Mon YYYY');
end $$;
revoke execute on function auto_close_month(date) from public, anon, authenticated;

-- Every day at 18:00 UTC = 23:30 IST.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('exit-auto-close-month', '0 18 * * *', 'select public.auto_close_month()');
