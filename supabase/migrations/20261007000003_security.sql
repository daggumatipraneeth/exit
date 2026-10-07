-- Row-level security and the private KYC bucket.
-- admin: everything. employee: customers, KYC and daily entries. franchisee: read their own; onboard drafts.

create function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function my_franchisee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select franchisee_id from profiles where id = auth.uid()
$$;

create function is_admin() returns boolean
language sql stable as $$ select coalesce(my_role() = 'admin', false) $$;

create function is_staff() returns boolean
language sql stable as $$ select coalesce(my_role() in ('admin', 'employee'), false) $$;

create function can_see_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (select 1 from customers where id = p_customer and franchisee_id = my_franchisee_id())
$$;

-- Franchisees may add KYC only while the customer is still being onboarded.
create function can_edit_kyc(p_customer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_staff() or exists (select 1 from customers where id = p_customer and franchisee_id = my_franchisee_id()
                                 and status in ('draft', 'awaiting_signature'))
$$;

-- Business rules row-level security can't express: franchisees can't set terms, only admins approve.
create function customer_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- server-side (service role / migrations / seed)
  end if;
  if not is_staff() then
    if tg_op = 'INSERT' then
      new.cap_pct := 6; -- default terms; admin adjusts on approval
    elsif new.cap_pct <> old.cap_pct or new.franchisee_id <> old.franchisee_id then
      raise exception 'Only Exit staff can change customer terms';
    end if;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') and not is_admin() then
    raise exception 'Only an admin can approve a customer';
  end if;
  return new;
end $$;

create trigger guard before insert or update on customers for each row execute function customer_guard();

alter table franchisees enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table customer_capital enable row level security;
alter table customer_documents enable row level security;
alter table agreement_templates enable row level security;
alter table agreements enable row level security;
alter table daily_entries enable row level security;
alter table daily_results enable row level security;
alter table closed_months enable row level security;
alter table audit_log enable row level security;

create policy read on franchisees for select to authenticated using (is_staff() or id = my_franchisee_id());
create policy admin_write on franchisees for all to authenticated using (is_admin()) with check (is_admin());

create policy read on profiles for select to authenticated using (id = auth.uid() or is_staff());
create policy admin_write on profiles for all to authenticated using (is_admin()) with check (is_admin());

create policy read on customers for select to authenticated using (is_staff() or franchisee_id = my_franchisee_id());
create policy staff_write on customers for all to authenticated using (is_staff()) with check (is_staff());
create policy franchisee_insert on customers for insert to authenticated
  with check (franchisee_id = my_franchisee_id() and status = 'draft');
create policy franchisee_update on customers for update to authenticated
  using (franchisee_id = my_franchisee_id() and status in ('draft', 'awaiting_signature'))
  with check (franchisee_id = my_franchisee_id() and status in ('draft', 'awaiting_signature'));

create policy read on customer_capital for select to authenticated using (can_see_customer(customer_id));
create policy staff_write on customer_capital for all to authenticated using (is_staff()) with check (is_staff());
create policy franchisee_insert on customer_capital for insert to authenticated with check (can_edit_kyc(customer_id));

create policy read on customer_documents for select to authenticated using (can_see_customer(customer_id));
create policy write on customer_documents for all to authenticated
  using (can_edit_kyc(customer_id)) with check (can_edit_kyc(customer_id));

create policy read on agreement_templates for select to authenticated using (true);
create policy admin_write on agreement_templates for all to authenticated using (is_admin()) with check (is_admin());

create policy read on agreements for select to authenticated using (can_see_customer(customer_id));
create policy create_link on agreements for insert to authenticated
  with check (can_edit_kyc(customer_id) and signed_at is null);
create policy staff_write on agreements for update to authenticated using (is_staff()) with check (is_staff());

create policy read on daily_entries for select to authenticated using (can_see_customer(customer_id));
create policy staff_write on daily_entries for all to authenticated using (is_staff()) with check (is_staff());

create policy read on daily_results for select to authenticated using (is_staff() or franchisee_id = my_franchisee_id());

create policy read on closed_months for select to authenticated using (true);
create policy admin_write on closed_months for all to authenticated using (is_admin()) with check (is_admin());

create policy admin_read on audit_log for select to authenticated using (is_admin());

-- Private KYC bucket. Paths: {customer_id}/{kind}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create function kyc_customer(p_name text) returns uuid
language sql immutable as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end
$$;

create policy kyc_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and can_see_customer(kyc_customer(name)));
create policy kyc_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and can_edit_kyc(kyc_customer(name)));
create policy kyc_update on storage.objects for update to authenticated
  using (bucket_id = 'kyc' and can_edit_kyc(kyc_customer(name)));
create policy kyc_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kyc' and is_staff());
