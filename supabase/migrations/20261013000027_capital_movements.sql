-- Capital becomes a ledger of movements instead of "new total from date" rows.
--   deposit     +amount  money received from the customer's bank account
--   withdrawal  -amount  paid out at a month close (written by close_month)
--   exit        -amount  everything paid back: full withdrawal at a close, or an emergency exit
--   correction  ±amount  an admin fixing a mistake
-- Capital on a day is the sum of movements in effect by then. Adding, withdrawing and closing are plain
-- inserts, so nothing ever has to rewrite later rows (the old running totals needed that, see BUG-5).
--
-- Money that reaches Exit before 12:00 IST counts from the next day; from 12:00 on, from the day after.
-- The server works that out from received_at: the browser never picks the date.

-- India has one time zone and no daylight saving.
create function today_ist() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create function effective_date(p_received timestamptz) returns date
language sql stable as $$
  select (p_received at time zone 'Asia/Kolkata')::date
       + case when (p_received at time zone 'Asia/Kolkata')::time < time '12:00' then 1 else 2 end
$$;

create type capital_kind as enum ('deposit', 'withdrawal', 'exit', 'correction');

create table capital_movements (
  id bigserial primary key,
  customer_id uuid not null references customers on delete restrict,
  kind capital_kind not null default 'deposit',
  amount numeric(14,2) not null check (amount <> 0),
  received_at timestamptz,          -- when the money reached Exit (deposits)
  effective_from date not null,     -- first day it counts
  settled_month date,               -- set on withdrawal/exit rows written by close_month, so a reopen can remove them
  note text,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  check (kind = 'correction' or (kind = 'deposit') = (amount > 0))
);
create index on capital_movements (customer_id, effective_from);

-- Old rows were running totals: each one becomes the change from the row before it.
insert into capital_movements (customer_id, kind, amount, effective_from, created_by, created_at)
select customer_id,
       case when delta > 0 then 'deposit'
            when exists (select 1 from settlements s where s.customer_id = x.customer_id and s.withdrawal > 0
                           and (s.month + interval '1 month')::date = x.effective_from) then 'withdrawal'
            else 'correction' end::capital_kind,
       delta, effective_from, null, now()
from (select customer_id, effective_from,
             amount - coalesce(lag(amount) over (partition by customer_id order by effective_from), 0) as delta
      from customer_capital) x
where delta <> 0;

drop table customer_capital; -- takes its triggers, policies and foreign key with it

create function capital_on(p_customer uuid, p_date date) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(amount), 0) from capital_movements where customer_id = p_customer and effective_from <= p_date
$$;

-- Including deposits received but not yet in effect.
create function total_capital(p_customer uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(amount), 0) from capital_movements where customer_id = p_customer
$$;

create or replace function current_capital(p_customer uuid) returns numeric
language sql stable set search_path = public as $$ select capital_on(p_customer, today_ist()) $$;

-- "Invested" for a month: capital on the 1st, or for someone who started during the month, their first capital.
create or replace function capital_for_month(p_customer uuid, p_month date) returns numeric
language sql stable set search_path = public as $$
  select coalesce(nullif(capital_on(p_customer, p_month), 0),
                  (select capital_on(p_customer, min(effective_from)) from capital_movements
                    where customer_id = p_customer and effective_from > p_month
                      and effective_from < (p_month + interval '1 month')::date), 0)
$$;

-- Pays back everything from p_from on: removes the capital in force that day, and cancels each later
-- movement (a deposit received but not yet in effect) on its own date, so capital never dips below zero.
-- Returns the total removed.
create function close_out_capital(p_customer uuid, p_from date, p_settled_month date default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric := capital_on(p_customer, p_from);
  k record;
begin
  if v_total <> 0 then
    insert into capital_movements (customer_id, kind, amount, effective_from, settled_month)
    values (p_customer, case when v_total > 0 then 'exit' else 'correction' end::capital_kind, -v_total, p_from, p_settled_month);
  end if;
  for k in select effective_from, sum(amount) as amount from capital_movements
            where customer_id = p_customer and effective_from > p_from group by effective_from order by effective_from loop
    if k.amount <> 0 then
      insert into capital_movements (customer_id, kind, amount, effective_from, settled_month)
      values (p_customer, case when k.amount > 0 then 'exit' else 'correction' end::capital_kind, -k.amount, k.effective_from, p_settled_month);
      v_total := v_total + k.amount;
    end if;
  end loop;
  return v_total;
end $$;
revoke execute on function close_out_capital(uuid, date, date) from public, anon, authenticated;

-- Customers who already left at a month close: their capital ends on the 1st after it.
do $$
declare s record;
begin
  for s in select customer_id, (month + interval '1 month')::date as nxt from settlements where full_exit loop
    perform close_out_capital(s.customer_id, s.nxt, (s.nxt - interval '1 month')::date);
  end loop;
end $$;

-- Rules on every write. Rows are never edited: a mistake is undone (deleted) and entered again.
-- Runs as the caller: current_user is 'authenticated' only when a person writes directly (the app), and the
-- table owner when a function such as close_month writes, so system rows keep their settled_month.
create function capital_movement_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_cust customers;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Capital entries can''t be changed. Undo it and add it again.';
  end if;
  select franchisee_id, status into v_cust.franchisee_id, v_cust.status from customers where id = coalesce(new.customer_id, old.customer_id);
  if tg_op = 'DELETE' then
    if exists (select 1 from closed_months where month = date_trunc('month', old.effective_from)::date) then
      raise exception '% is closed, so this can''t be undone', to_char(old.effective_from, 'Mon YYYY');
    end if;
    return old;
  end if;
  if new.received_at is not null then
    new.effective_from := effective_date(new.received_at);
  end if;
  if current_user = 'authenticated' then
    if new.kind = 'deposit' and new.received_at is null then
      raise exception 'Enter when the money reached Exit';
    end if;
    if new.kind <> 'deposit' and not is_admin() then
      raise exception 'Only an Exit admin can record that';
    end if;
    if v_cust.status = 'closed' then
      raise exception 'This account is closed';
    end if;
  end if;
  return new;
end $$;
create trigger guard before insert or update or delete on capital_movements
  for each row execute function capital_movement_guard();

-- Checked at commit, after all of a transaction's movements are in: capital never goes below zero on any day.
create function capital_not_negative() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_customer uuid := coalesce(new.customer_id, old.customer_id);
begin
  if exists (select 1 from (select sum(amount) over (order by effective_from) as running
                              from (select effective_from, sum(amount) as amount from capital_movements
                                     where customer_id = v_customer group by effective_from) d) r
              where r.running < 0) then
    raise exception 'Capital can''t go below zero';
  end if;
  return null;
end $$;
create constraint trigger not_negative after insert or delete on capital_movements
  deferrable initially deferred for each row execute function capital_not_negative();

create trigger queue before insert or update or delete on capital_movements for each statement execute function payout_queue();
create trigger recompute after insert or update or delete on capital_movements for each row execute function capital_changed();
create trigger review after insert or update or delete on capital_movements for each row execute function customer_review();
create trigger audit after insert or update or delete on capital_movements for each row execute function audit();

create or replace function customer_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'capital_movements' then
    update customers set status = 'draft' where id = coalesce(new.customer_id, old.customer_id) and status = 'pending_approval';
    return null;
  end if;
  if new.status = 'rejected' then
    if old.status <> 'rejected' and auth.uid() is not null and coalesce(trim(new.reject_reason), '') = '' then
      raise exception 'Give a reason for rejecting';
    end if;
  else
    new.reject_reason := null;
  end if;
  if old.status = 'pending_approval' and new.status = 'pending_approval'
     and (new.full_name, new.pan_hash, new.franchisee_id, new.cap_pct, new.plan)
         is distinct from (old.full_name, old.pan_hash, old.franchisee_id, old.cap_pct, old.plan) then
    new.status := 'draft';
  end if;
  return new;
end $$;

alter table capital_movements enable row level security;
create policy read on capital_movements for select to authenticated using (can_see_customer(customer_id));
-- Staff record money any time; a partner only while onboarding. Undo: admin, or the partner while onboarding.
create policy add on capital_movements for insert to authenticated with check (is_staff() or can_edit_kyc(customer_id));
create policy undo on capital_movements for delete to authenticated using (is_admin() or can_edit_kyc(customer_id));
revoke all on capital_movements from anon, authenticated; -- Supabase grants everything on new tables by default
grant select, delete on capital_movements to authenticated;
grant insert (customer_id, kind, amount, received_at, effective_from, note) on capital_movements to authenticated;
grant usage on sequence capital_movements_id_seq to authenticated;

-- Readers that used the old table.
create or replace function render_agreement(p_agreement uuid) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(t.body,
    '{{full_name}}', html_escape(c.full_name)),
    '{{pan}}', html_escape(pii_decrypt(c.pan_enc))),
    '{{franchisee}}', html_escape(f.name)),
    '{{cap_pct}}', rtrim(to_char(c.cap_pct, 'FM990.##'), '.')),
    '{{capital}}', '₹' || to_char(total_capital(c.id), 'FM99,99,99,99,999')),
    '{{date}}', to_char(now() at time zone 'Asia/Kolkata', 'FMDD FMMonth YYYY'))
  from agreements a
  join agreement_templates t on t.version = a.template_version
  join customers c on c.id = a.customer_id
  join franchisees f on f.id = c.franchisee_id
  where a.id = p_agreement
$$;

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
  if total_capital(p_customer) <= 0 then missing := missing || 'capital'::text; end if;
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
  -- An active customer re-signing a newer agreement stays active.
  update customers set status = 'awaiting_signature' where id = p_customer and status <> 'active';
  return v_token;
end $$;
