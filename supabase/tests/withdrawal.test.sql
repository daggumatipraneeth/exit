-- A withdrawal settled at month close comes off from the 1st of next month; a top-up already recorded for a
-- later date still adds on top, and a reopen takes the withdrawal back out. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into franchisees (id, name) values ('f4000000-0000-0000-0000-000000000001', 'Withdraw Partner');
insert into franchisee_terms values ('f4000000-0000-0000-0000-000000000001', 0);
insert into auth.users (id, email) values ('a8000000-0000-0000-0000-000000000001', 'admin@withdraw.test');
insert into profiles (id, role) values ('a8000000-0000-0000-0000-000000000001', 'admin');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c4000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', 'Topup Tara', '9000000077', 'active');
-- ₹1,00,000 from Jan; a ₹50,000 top-up counting from 10 Feb is recorded before January is closed.
insert into capital_movements (customer_id, effective_from, amount) values
  ('c4000000-0000-0000-0000-000000000001', '2020-01-01', 100000),
  ('c4000000-0000-0000-0000-000000000001', '2020-02-10', 50000);
insert into daily_entries (franchisee_id, trade_date, amount) values ('f4000000-0000-0000-0000-000000000001', '2020-01-06', 1000);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a8000000-0000-0000-0000-000000000001"}';
select request_withdrawal(20000, 'c4000000-0000-0000-0000-000000000001');
select lives_ok($$select close_month('2020-01-01')$$, 'January closes with the withdrawal');
select results_eq(
  $$select d, capital_on('c4000000-0000-0000-0000-000000000001', d) from unnest('{2020-01-01,2020-02-01,2020-02-10}'::date[]) d$$,
  $$values ('2020-01-01'::date, 100000.00), ('2020-02-01', 80000.00), ('2020-02-10', 130000.00)$$,
  'withdrawal counts from 1 Feb and the later top-up still adds on top');
select is(total_capital('c4000000-0000-0000-0000-000000000001'), 130000.00, 'capital is the top-up less the withdrawal');

select lives_ok($$select reopen_month('2020-01-01')$$, 'January reopens');
select results_eq(
  $$select effective_from, amount from capital_movements where customer_id = 'c4000000-0000-0000-0000-000000000001' order by 1$$,
  $$values ('2020-01-01'::date, 100000.00), ('2020-02-10', 50000.00)$$,
  'reopening removes the withdrawal the close added');

select * from finish();
rollback;
