-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into franchisees (id, name) values ('f9000000-0000-0000-0000-000000000001', 'Mobile Partner');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c9000000-0000-0000-0000-000000000001', 'f9000000-0000-0000-0000-000000000001', 'First', '+91 97000 00001', 'draft');

select throws_ok($$insert into customers (franchisee_id, full_name, phone, status)
  values ('f9000000-0000-0000-0000-000000000001', 'Second', '9700000001', 'draft')$$,
  'P0001', 'Another customer already uses this mobile number', 'same mobile, different format, is refused');
select lives_ok($$insert into customers (id, franchisee_id, full_name, phone, status)
  values ('c9000000-0000-0000-0000-000000000002', 'f9000000-0000-0000-0000-000000000001', 'Second', '9700000002', 'draft')$$,
  'a different mobile is fine');
select throws_ok($$update customers set phone = '97000 00001' where id = 'c9000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Another customer already uses this mobile number', 'editing to a taken mobile is refused');
select lives_ok($$update customers set full_name = 'First Renamed', phone = '+91 97000 00001' where id = 'c9000000-0000-0000-0000-000000000001'$$,
  'a customer keeps their own mobile');

select * from finish();
rollback;
