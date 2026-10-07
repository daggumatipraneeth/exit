-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into franchisees (id, name) values
  ('f4000000-0000-0000-0000-000000000001', 'Login Partner Busy'), ('f4000000-0000-0000-0000-000000000002', 'Login Partner Empty');
insert into franchisee_terms values ('f4000000-0000-0000-0000-000000000001', 10), ('f4000000-0000-0000-0000-000000000002', 10);
insert into auth.users (id, email) values ('a4000000-0000-0000-0000-000000000001', 'leaver@test');
insert into profiles (id, role) values ('a4000000-0000-0000-0000-000000000001', 'employee');

-- The leaver created a customer and an entry, then the month was closed.
insert into customers (id, franchisee_id, full_name, phone, status, created_by) values
  ('c4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', 'Kept Customer', '1', 'active', 'a4000000-0000-0000-0000-000000000001');
insert into customer_capital values ('c4000000-0000-0000-0000-000000000001', '2020-01-01', 100000);
insert into daily_entries (franchisee_id, trade_date, amount, entered_by) values
  ('f4000000-0000-0000-0000-000000000001', '2020-06-01', 1000, 'a4000000-0000-0000-0000-000000000001');
insert into closed_months (month) values ('2020-06-01');

select ok(not partner_deletable('f4000000-0000-0000-0000-000000000001'), 'partner with customers and results cannot be deleted');
select ok(partner_deletable('f4000000-0000-0000-0000-000000000002'), 'empty partner can be deleted');

-- Removing the login keeps everything they made.
select lives_ok($$delete from auth.users where id = 'a4000000-0000-0000-0000-000000000001'$$, 'login removed even though it made records in a closed month');
select is((select count(*) from profiles where id = 'a4000000-0000-0000-0000-000000000001'), 0::bigint, 'profile goes with the login');
select results_eq($$select full_name, created_by from customers where id = 'c4000000-0000-0000-0000-000000000001'$$,
  $$values ('Kept Customer'::text, null::uuid)$$, 'customer kept; creator link cleared');
select results_eq($$select amount, entered_by from daily_entries where franchisee_id = 'f4000000-0000-0000-0000-000000000001'$$,
  $$values (1000.00::numeric(14,2), null::uuid)$$, 'closed-month entry kept unchanged; who-entered cleared');
select is((select count(*) from audit_log where table_name = 'profiles' and op = 'DELETE' and old->>'id' = 'a4000000-0000-0000-0000-000000000001'),
  1::bigint, 'activity log keeps a record of the removed login');

select * from finish();
rollback;
