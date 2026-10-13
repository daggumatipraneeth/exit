-- A withdrawal settled at month close must also lower capital rows already entered for later dates.
-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into franchisees (id, name) values ('f4000000-0000-0000-0000-000000000001', 'Withdraw Partner');
insert into franchisee_terms values ('f4000000-0000-0000-0000-000000000001', 0);
insert into auth.users (id, email) values ('a8000000-0000-0000-0000-000000000001', 'admin@withdraw.test');
insert into profiles (id, role) values ('a8000000-0000-0000-0000-000000000001', 'admin');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', 'Topup Tara', '9000000077', 'active');
-- ₹1,00,000 from Jan; a top-up to ₹1,50,000 from 10 Feb is recorded before January is closed.
insert into customer_capital values
  ('c4000000-0000-0000-0000-000000000001', '2020-01-01', 100000),
  ('c4000000-0000-0000-0000-000000000001', '2020-02-10', 150000);
insert into daily_entries (franchisee_id, trade_date, amount) values ('f4000000-0000-0000-0000-000000000001', '2020-01-06', 1000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-0000-0000-000000000001"}';
select request_withdrawal(20000, 'c4000000-0000-0000-0000-000000000001');
select lives_ok($$select close_month('2020-01-01')$$, 'January closes with the withdrawal');
select results_eq(
  $$select effective_from, amount from customer_capital where customer_id = 'c4000000-0000-0000-0000-000000000001' order by 1$$,
  $$values ('2020-01-01'::date, 100000.00), ('2020-02-01', 80000.00), ('2020-02-10', 130000.00)$$,
  'withdrawal comes off from 1 Feb and off the later top-up total too');
select is(current_capital('c4000000-0000-0000-0000-000000000001'), 130000.00, 'capital now is the top-up less the withdrawal');

select lives_ok($$select reopen_month('2020-01-01')$$, 'January reopens');
select results_eq(
  $$select effective_from, amount from customer_capital where customer_id = 'c4000000-0000-0000-0000-000000000001' order by 1$$,
  $$values ('2020-01-01'::date, 100000.00), ('2020-02-10', 150000.00)$$,
  'reopening puts the withdrawal back on every later row and drops the row the close added');

select * from finish();
rollback;
