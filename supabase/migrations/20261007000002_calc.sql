-- The money waterfall. All payout maths lives here, never in the browser.
--
-- Exit enters one profit/loss figure per partner per day. For that partner, in day order within a month:
--   net = amount − hidden charge %   (profit days only; a loss passes through unchanged)
--   Profit fills the customers' monthly buckets (cap % × capital) in proportion to capital.
--     A bucket that fills early spills its extra to the customers who still have room.
--   Whatever is left once every bucket is full is split: partner profit_share_pct, Exit the rest.
--   A loss comes out of the customers' buckets in proportion to capital (buckets can go below zero).
--     Partner income already earned is never taken back.
-- Buckets reset on the 1st of each month.

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

create function array_total(a numeric[]) returns numeric
language sql immutable as $$ select coalesce(sum(x), 0) from unnest(a) x $$;

create function recompute_month(p_franchisee uuid, p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  m_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  ids uuid[]; weights numeric[]; caps numeric[]; starts date[];
  covered numeric[]; got numeric[];
  n int := 0;
  e daily_entries;
  v_net numeric; v_left numeric; v_total numeric; v_room numeric; v_over numeric; v_partner numeric;
  topped boolean; eligible int; cents int; i int; pick int;
  ok boolean[]; rem numeric[];
begin
  delete from franchisee_days where franchisee_id = p_franchisee and trade_date >= m and trade_date < m_end; -- cascades to customer_days

  -- Active customers with capital this month. Each joins from their first capital date.
  select array_agg(c.id order by k.capital desc, c.id), array_agg(k.capital order by k.capital desc, c.id),
         array_agg(round(k.capital * c.cap_pct / 100, 2) order by k.capital desc, c.id),
         array_agg(k.start order by k.capital desc, c.id)
    into ids, weights, caps, starts
  from customers c
  cross join lateral (select capital_for_month(c.id, m) as capital,
                             (select min(effective_from) from customer_capital where customer_id = c.id) as start) k
  where c.franchisee_id = p_franchisee and c.status = 'active' and k.capital > 0;
  n := coalesce(array_length(ids, 1), 0);
  covered := array_fill(0::numeric, array[greatest(n, 1)]);

  for e in select * from daily_entries
            where franchisee_id = p_franchisee and trade_date >= m and trade_date < m_end
            order by trade_date loop
    v_net := case when e.amount > 0 then round(e.amount * (100 - e.hidden_charge_pct) / 100, 2) else e.amount end;
    got := array_fill(0::numeric, array[greatest(n, 1)]);
    ok := array_fill(false, array[greatest(n, 1)]);
    eligible := 0;
    for i in 1..n loop
      ok[i] := starts[i] <= e.trade_date;
      if ok[i] then eligible := eligible + 1; end if;
    end loop;

    if v_net >= 0 then
      -- Water-fill: anyone whose proportional share would overflow is topped up exactly; repeat with the rest.
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
          if ok[i] and v_room > 0 and v_left * weights[i] / v_total >= v_room then
            got[i] := got[i] + v_room;
            topped := true;
          end if;
        end loop;
        continue when topped;
        -- Nobody overflows: split the rest by capital in whole paise; leftover paise go to the largest remainders.
        rem := array_fill(-1::numeric, array[greatest(n, 1)]);
        for i in 1..n loop
          if ok[i] and caps[i] - covered[i] - got[i] > 0 then
            rem[i] := v_left * weights[i] / v_total - trunc(v_left * weights[i] / v_total, 2);
            got[i] := got[i] + trunc(v_left * weights[i] / v_total, 2);
          end if;
        end loop;
        cents := round((v_net - array_total(got)) * 100);
        while cents > 0 loop
          pick := null;
          for i in 1..n loop
            if rem[i] >= 0 and caps[i] - covered[i] - got[i] >= 0.01 and (pick is null or rem[i] > rem[pick]) then pick := i; end if;
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
      -- Loss: debit every customer by capital share, leftover paise to the largest holders.
      v_total := 0;
      for i in 1..n loop
        if ok[i] then v_total := v_total + weights[i]; end if;
      end loop;
      if v_total > 0 then
        rem := array_fill(-1::numeric, array[greatest(n, 1)]);
        for i in 1..n loop
          if ok[i] then
            got[i] := trunc(v_net * weights[i] / v_total, 2);
            rem[i] := got[i] - v_net * weights[i] / v_total; -- how far short of the exact debit
          end if;
        end loop;
        cents := round((array_total(got) - v_net) * 100);
        while cents > 0 loop
          pick := null;
          for i in 1..n loop
            if rem[i] >= 0 and (pick is null or rem[i] > rem[pick]) then pick := i; end if;
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

-- Recompute every open (not closed) month that has entries for this partner.
create function recompute_partner(p_franchisee uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m date;
begin
  for m in select distinct date_trunc('month', trade_date)::date from daily_entries e
            where franchisee_id = p_franchisee
              and not exists (select 1 from closed_months cm where cm.month = date_trunc('month', e.trade_date)::date) loop
    perform recompute_month(p_franchisee, m);
  end loop;
end $$;

revoke execute on function recompute_month(uuid, date), recompute_partner(uuid) from public, anon, authenticated;

-- Before write on daily_entries: block closed months, snapshot the partner's terms on first entry.
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
  if tg_op = 'INSERT' or new.franchisee_id <> old.franchisee_id then
    select t.hidden_charge_pct, f.profit_share_pct into new.hidden_charge_pct, new.profit_share_pct
      from franchisees f join franchisee_terms t on t.franchisee_id = f.id where f.id = new.franchisee_id;
    if new.hidden_charge_pct is null then
      raise exception 'Set this partner''s hidden charge before entering results';
    end if;
  else
    -- keep the terms that applied when first entered
    new.hidden_charge_pct := old.hidden_charge_pct;
    new.profit_share_pct := old.profit_share_pct;
  end if;
  return new;
end $$;

create trigger guard before insert or update or delete on daily_entries
  for each row execute function daily_entry_guard();

create function daily_entry_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then
    perform recompute_month(old.franchisee_id, old.trade_date);
  end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.franchisee_id <> old.franchisee_id
                            or date_trunc('month', new.trade_date) <> date_trunc('month', old.trade_date)) then
    perform recompute_month(new.franchisee_id, new.trade_date);
  end if;
  return null;
end $$;

create trigger recompute after insert or update or delete on daily_entries
  for each row execute function daily_entry_recompute();

-- Customer changes that alter the split re-run the partner's open months.
create function capital_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_partner(franchisee_id) from customers where id = coalesce(new.customer_id, old.customer_id);
  return null;
end $$;

create trigger recompute after insert or update or delete on customer_capital
  for each row execute function capital_changed();

create function customer_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_partner(new.franchisee_id);
  if new.franchisee_id <> old.franchisee_id then
    perform recompute_partner(old.franchisee_id);
  end if;
  return null;
end $$;

create trigger recompute after update of cap_pct, franchisee_id, status on customers
  for each row when (old.cap_pct is distinct from new.cap_pct or old.franchisee_id is distinct from new.franchisee_id
                     or (old.status = 'active') <> (new.status = 'active'))
  execute function customer_changed();

-- Dashboard views. security_invoker so row-level security of the caller applies.
create view customer_month_progress with (security_invoker = true) as
select customer_id, franchisee_id,
       date_trunc('month', trade_date)::date as month,
       max(cap) as cap,
       (array_agg(covered order by trade_date desc))[1] as covered,
       sum(credited) as credited
from customer_days
group by customer_id, franchisee_id, date_trunc('month', trade_date);
