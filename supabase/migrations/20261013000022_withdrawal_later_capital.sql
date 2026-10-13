-- A partial withdrawal lowers capital from the 1st of next month. Capital rows are running totals, so any
-- row already entered for a later date (a top-up recorded before the month was closed) must drop by the same
-- amount, or the withdrawn money reappears from that date. Reopening a month puts it back on all of them,
-- and drops the row the close added on the 1st, so the customer's deposit history shows no phantom deposit.
create or replace function close_month(p_month date) returns void
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
        update customer_capital set amount = amount - v_w where customer_id = r.id and effective_from > nxt;
      end if;
      update withdrawal_requests set status = 'settled', settled_month = m where id = w.id;
    end if;

    insert into settlements (customer_id, month, plan, invested, result, carried_in, profit_payout,
                             withdrawal, full_exit, payout_total, carried_out)
    values (r.id, m, r.plan, r.invested, r.result, v_carried, v_profit, v_w, v_full, v_profit + v_w, v_out);
  end loop;
end $$;

-- Undo a close while nothing has been paid: restores withdrawals and capital, then reopens.
create or replace function reopen_month(p_month date) returns void
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
      update customer_capital set amount = amount + st.withdrawal where customer_id = st.customer_id and effective_from >= nxt;
      -- The close added a row on the 1st; once restored it repeats the amount before it, so drop it.
      delete from customer_capital k where k.customer_id = st.customer_id and k.effective_from = nxt
        and k.amount = (select amount from customer_capital p where p.customer_id = st.customer_id and p.effective_from < nxt
                         order by effective_from desc limit 1);
    end if;
  end loop;
  update withdrawal_requests set status = 'open', settled_month = null where status = 'settled' and settled_month = m;
  delete from closed_months where month = m; -- cascades to settlements
end $$;
