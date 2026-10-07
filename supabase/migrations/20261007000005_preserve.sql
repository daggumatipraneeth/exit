-- Keep every customer record, KYC file and signed agreement permanently.

-- KYC documents keep every version: a new upload adds a row (and a new file); the latest per kind is current.
alter table customer_documents drop constraint customer_documents_customer_id_kind_key;
create index on customer_documents (customer_id, kind, uploaded_at desc);

-- Deleting a customer must never take their records with it.
alter table customer_documents drop constraint customer_documents_customer_id_fkey,
  add constraint customer_documents_customer_id_fkey foreign key (customer_id) references customers on delete restrict;
alter table agreements drop constraint agreements_customer_id_fkey,
  add constraint agreements_customer_id_fkey foreign key (customer_id) references customers on delete restrict;
alter table customer_capital drop constraint customer_capital_customer_id_fkey,
  add constraint customer_capital_customer_id_fkey foreign key (customer_id) references customers on delete restrict;

-- Triggers apply to everyone, including the service role and the dashboard, not just logged-in users.
create function keep_records() returns trigger
language plpgsql as $$
begin
  raise exception '%', tg_argv[0];
end $$;

create trigger keep before delete on customers
  for each row execute function keep_records('Customers are kept permanently. Reject or deactivate instead of deleting.');
create trigger keep before update or delete on customer_documents
  for each row execute function keep_records('KYC documents are kept permanently. Upload a new version instead.');
-- Unsigned links can still be replaced (create_signing_link deletes them); signed agreements are frozen.
create trigger keep before update or delete on agreements
  for each row when (old.signed_at is not null)
  execute function keep_records('Signed agreements are kept permanently and cannot be changed.');

-- KYC files: no overwriting (new versions get new paths) and no deleting.
drop policy kyc_update on storage.objects;
drop policy kyc_delete on storage.objects;
drop policy write on customer_documents;
create policy add on customer_documents for insert to authenticated with check (can_edit_kyc(customer_id));

create function keep_kyc_file() returns trigger
language plpgsql as $$
begin
  raise exception 'KYC files are kept permanently';
end $$;

create trigger keep_kyc before delete on storage.objects
  for each row when (old.bucket_id = 'kyc') execute function keep_kyc_file();
