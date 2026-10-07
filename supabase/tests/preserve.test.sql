-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into franchisees (id, name) values ('f2000000-0000-0000-0000-000000000001', 'Keep Partner');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'Kept', '1', 'draft');

-- Every KYC upload is kept as a version.
insert into customer_documents (customer_id, kind, path, uploaded_at) values
  ('c2000000-0000-0000-0000-000000000001', 'pan', 'c2000000-0000-0000-0000-000000000001/pan-1', now() - interval '1 day');
select lives_ok($$insert into customer_documents (customer_id, kind, path) values
  ('c2000000-0000-0000-0000-000000000001', 'pan', 'c2000000-0000-0000-0000-000000000001/pan-2')$$, 'a second PAN upload is kept alongside the first');
select is((select count(*) from customer_documents where customer_id = 'c2000000-0000-0000-0000-000000000001'), 2::bigint, 'both versions stored');
select throws_ok($$delete from customer_documents where customer_id = 'c2000000-0000-0000-0000-000000000001'$$,
  'P0001', 'KYC documents are kept permanently. Upload a new version instead.', 'documents cannot be deleted');
select throws_ok($$update customer_documents set path = 'x' where customer_id = 'c2000000-0000-0000-0000-000000000001'$$,
  'P0001', 'KYC documents are kept permanently. Upload a new version instead.', 'documents cannot be edited');

-- Customers are never deleted, even by the database owner.
select throws_ok($$delete from customers where id = 'c2000000-0000-0000-0000-000000000001'$$,
  'P0001', 'Customers are kept permanently. Reject or deactivate instead of deleting.', 'customers cannot be deleted');

-- Unsigned links can be replaced; signed agreements are frozen.
insert into agreements (id, customer_id, template_version) values ('a2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 1);
select lives_ok($$delete from agreements where id = 'a2000000-0000-0000-0000-000000000001'$$, 'an unsigned link can be removed');
insert into agreements (id, customer_id, template_version, rendered_html, signed_at, signer_name)
values ('a2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 1, '<p>Signed text</p>', now(), 'Kept');
select throws_ok($$delete from agreements where id = 'a2000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Signed agreements are kept permanently and cannot be changed.', 'signed agreement cannot be deleted');
select throws_ok($$update agreements set rendered_html = '<p>Changed</p>' where id = 'a2000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Signed agreements are kept permanently and cannot be changed.', 'signed agreement cannot be edited');

-- KYC files in storage cannot be deleted.
insert into storage.objects (bucket_id, name) values ('kyc', 'c2000000-0000-0000-0000-000000000001/pan-1');
-- Direct SQL is refused; the Storage API route is refused by the keep_kyc trigger.
select throws_ok($$delete from storage.objects where bucket_id = 'kyc'$$, null, null, 'KYC files cannot be deleted');

-- Logged-in staff can't overwrite a KYC file either (no update policy).
insert into auth.users (id, email) values ('a2000000-0000-0000-0000-0000000000aa', 'k@test');
insert into profiles (id, role) values ('a2000000-0000-0000-0000-0000000000aa', 'admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-0000000000aa"}';
update storage.objects set metadata = '{"x":1}' where bucket_id = 'kyc';
reset role;
select is((select metadata from storage.objects where bucket_id = 'kyc' and name = 'c2000000-0000-0000-0000-000000000001/pan-1'), null::jsonb,
  'admins cannot overwrite a KYC file');
select is((select count(*) from storage.objects where bucket_id = 'kyc' and name = 'c2000000-0000-0000-0000-000000000001/pan-1'), 1::bigint, 'file still there');

select * from finish();
rollback;
