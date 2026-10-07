-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into franchisees (id, name) values ('f6000000-0000-0000-0000-000000000001', 'Split A'), ('f6000000-0000-0000-0000-000000000002', 'Split B');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c6000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'A1', '1', 'active'),
  ('c6000000-0000-0000-0000-000000000002', 'f6000000-0000-0000-0000-000000000001', 'A2 starts later', '2', 'active'),
  ('c6000000-0000-0000-0000-000000000003', 'f6000000-0000-0000-0000-000000000002', 'B1', '3', 'active'),
  ('c6000000-0000-0000-0000-000000000004', 'f6000000-0000-0000-0000-000000000002', 'B2 inactive', '4', 'rejected');
insert into customer_capital values
  ('c6000000-0000-0000-0000-000000000001', '2030-01-01', 100000),
  ('c6000000-0000-0000-0000-000000000001', '2030-03-20', 999999), -- a mid-month change counts from next month, as payouts do
  ('c6000000-0000-0000-0000-000000000002', '2030-03-15', 50000),
  ('c6000000-0000-0000-0000-000000000003', '2030-01-01', 300000),
  ('c6000000-0000-0000-0000-000000000004', '2030-01-01', 700000);

select results_eq($$select capital from partner_capital_on('2030-03-10') where franchisee_id = 'f6000000-0000-0000-0000-000000000001'$$,
  $$values (100000::numeric)$$, 'a customer counts only from their start day');
select results_eq($$select capital from partner_capital_on('2030-03-25') where franchisee_id = 'f6000000-0000-0000-0000-000000000001'$$,
  $$values (150000::numeric)$$, 'capital as payouts count it: start-of-month amount, plus customers who have started');
select results_eq($$select capital from partner_capital_on('2030-03-25') where franchisee_id = 'f6000000-0000-0000-0000-000000000002'$$,
  $$values (300000::numeric)$$, 'inactive customers are left out');

insert into auth.users (id, email) values ('a6000000-0000-0000-0000-000000000001', 'splitpartner@test');
insert into profiles (id, role, franchisee_id) values ('a6000000-0000-0000-0000-000000000001', 'franchisee', 'f6000000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a6000000-0000-0000-0000-000000000001"}';
select is((select count(*) from partner_capital_on('2030-03-25') where franchisee_id = 'f6000000-0000-0000-0000-000000000002'), 0::bigint,
  'a partner cannot see other partners'' capital');
reset role;

select * from finish();
rollback;
