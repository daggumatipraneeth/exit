-- my_account() tells the customer the running result of the month that closes next, since a loss there
-- comes off what they can withdraw. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into franchisees (id, name) values ('f9300000-0000-0000-0000-000000000001', 'Account Partner');
insert into franchisee_terms values ('f9300000-0000-0000-0000-000000000001', 0);
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c9300000-0000-0000-0000-000000000001', 'f9300000-0000-0000-0000-000000000001', 'Loss Lata', '9700000031', 'active');
insert into capital_movements (customer_id, effective_from, amount) values ('c9300000-0000-0000-0000-000000000001', '2019-01-01', 100000);
insert into auth.users (id, email) values ('a9300000-0000-0000-0000-000000000001', '9700000031@customer.exit');
insert into profiles (id, full_name, role, customer_id) values
  ('a9300000-0000-0000-0000-000000000001', 'Loss Lata', 'customer', 'c9300000-0000-0000-0000-000000000001');
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('f9300000-0000-0000-0000-000000000001', '2019-01-07', -3000), ('f9300000-0000-0000-0000-000000000001', '2019-01-08', 1000),
  ('f9300000-0000-0000-0000-000000000001', '2019-02-04', 500);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9300000-0000-0000-0000-000000000001"}';
select is((my_account()->'next_close')::jsonb, '{"month": "2019-01-01", "result": -2000.00}'::jsonb,
  'the earliest open month and its result so far');
select is((my_account()->>'withdrawable')::numeric, 100000.00, 'withdrawable itself is unchanged until the month closes');

select * from finish();
rollback;
