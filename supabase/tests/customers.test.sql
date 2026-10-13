-- Customer logins, bank details, withdrawals and month-close settlements. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- One partner (no hidden charge, to keep the sums round), two customers with ₹1,00,000 each, cap 6% = ₹6,000.
insert into franchisees (id, name) values ('f3000000-0000-0000-0000-000000000001', 'Settle Partner');
insert into franchisee_terms values ('f3000000-0000-0000-0000-000000000001', 0);
insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'admin@settle.test'),
  ('a7000000-0000-0000-0000-000000000002', 'partner@settle.test'),
  ('a7000000-0000-0000-0000-000000000003', '9000000099@customer.exit');
insert into customers (id, franchisee_id, full_name, phone, plan, status) values
  ('c3000000-0000-0000-0000-00000000000a', 'f3000000-0000-0000-0000-000000000001', 'Vani Variable', '9000000099', 'variable', 'active'),
  ('c3000000-0000-0000-0000-00000000000b', 'f3000000-0000-0000-0000-000000000001', 'Fani Fixed', '9000000098', 'fixed', 'active');
insert into customer_capital values
  ('c3000000-0000-0000-0000-00000000000a', '2021-01-01', 100000),
  ('c3000000-0000-0000-0000-00000000000b', '2021-01-01', 100000);
insert into agreements (customer_id, template_version, signed_at) values
  ('c3000000-0000-0000-0000-00000000000a', 1, now()), ('c3000000-0000-0000-0000-00000000000b', 1, now());
insert into profiles (id, role, franchisee_id, customer_id) values
  ('a7000000-0000-0000-0000-000000000001', 'admin', null, null),
  ('a7000000-0000-0000-0000-000000000002', 'franchisee', 'f3000000-0000-0000-0000-000000000001', null),
  ('a7000000-0000-0000-0000-000000000003', 'customer', null, 'c3000000-0000-0000-0000-00000000000a');

-- Jan: −20,000 (−10k each). Feb: +12,000 (+6k each, buckets full). Mar: +10,000 (+5k each).
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('f3000000-0000-0000-0000-000000000001', '2021-01-04', -20000),
  ('f3000000-0000-0000-0000-000000000001', '2021-02-01', 12000),
  ('f3000000-0000-0000-0000-000000000001', '2021-03-01', 10000);

set local role authenticated;

-- Partner can't close months.
set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000002"}';
select throws_ok($$select close_month('2021-01-01')$$, 'P0001', 'Only an admin can close a month', 'partner cannot close a month');

set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000001"}';
select throws_ok($$select close_month('2021-02-01')$$, 'P0001', 'Close earlier months first', 'months close in order');
select lives_ok($$select close_month('2021-01-01')$$, 'admin closes January');
select results_eq(
  $$select plan::text, result, profit_payout, payout_total, carried_out from settlements
     where month = '2021-01-01' order by customer_id$$,
  $$values ('variable', -10000.00, 0.00, 0.00, -10000.00), ('fixed', -10000.00, 6000.00, 6000.00, 0.00)$$,
  'loss month: variable pays nothing and carries the loss, fixed still gets its 6%');

select lives_ok($$select close_month('2021-02-01')$$, 'admin closes February');
select results_eq(
  $$select plan::text, carried_in, profit_payout, carried_out from settlements where month = '2021-02-01' order by customer_id$$,
  $$values ('variable', -10000.00, 0.00, -4000.00), ('fixed', 0.00, 6000.00, 0.00)$$,
  'profit first recovers the carried loss');

-- The customer's own view: their figures, never the cap.
set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000003"}';
select is((my_account('2021-02-01')->>'month_pnl')::numeric, 6000.00, 'customer sees month P&L');
select is((select count(*) from json_object_keys(my_account('2021-02-01')) k where k ~ 'cap|covered|max'), 0::bigint, 'no cap fields in my_account');
select is((select count(*) from json_object_keys(my_account('2021-02-01')->'days'->0)), 2::bigint, 'daily rows carry only date and P&L');
select is((select count(*) from customer_days), 0::bigint, 'customer cannot read customer_days');
select is((select count(*) from customers), 0::bigint, 'customer cannot read customers');
select is((select count(*) from franchisees), 0::bigint, 'customer cannot read partner terms');
select is((select count(*) from settlements), 2::bigint, 'customer sees only their own settlements');
select is(pan_available('ZZZZZ9999Z'), false, 'customer cannot probe PANs');

-- Withdrawals: capped at capital less carried loss (100,000 − 4,000), one at a time, own account only.
select throws_like($$select request_withdrawal(96000.01)$$, '%up to ₹96,000.00%', 'withdrawal capped at capital less carried loss');
select lives_ok($$select request_withdrawal(50000)$$, 'customer requests a partial withdrawal');
select throws_like($$select request_withdrawal(10)$$, '%already a withdrawal request%', 'only one open request');
select throws_ok($$select request_withdrawal(10, 'c3000000-0000-0000-0000-00000000000b')$$, 'P0001', 'You cannot change this account',
  'customer cannot request for someone else');

-- Fixed customer leaves completely (staff can raise it for them).
reset role;
insert into withdrawal_requests (customer_id, amount) values ('c3000000-0000-0000-0000-00000000000b', 100000);
set local role authenticated;
set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000001"}';
select lives_ok($$select close_month('2021-03-01')$$, 'admin closes March');
select results_eq(
  $$select plan::text, profit_payout, withdrawal, full_exit, payout_total from settlements where month = '2021-03-01' order by customer_id$$,
  $$values ('variable', 1000.00, 50000.00, false, 51000.00), ('fixed', 6000.00, 100000.00, true, 106000.00)$$,
  'March pays profit plus withdrawals');
select results_eq(
  $$select (select amount from customer_capital where customer_id = 'c3000000-0000-0000-0000-00000000000a' and effective_from = '2021-04-01'),
           (select status::text from customers where id = 'c3000000-0000-0000-0000-00000000000b')$$,
  $$values (50000.00, 'closed')$$,
  'partial withdrawal lowers capital from next month; full withdrawal closes the account');
select results_eq(
  $$select beneficiary_name, amount from payout_file('2021-03-01')$$,
  $$values (null::text, 106000.00), (null::text, 51000.00)$$,
  'payout file lists everyone being paid');

-- Reopen undoes it all while unpaid; once paid it can't be reopened.
select lives_ok($$select reopen_month('2021-03-01')$$, 'admin reopens unpaid March');
select results_eq(
  $$select (select amount from customer_capital where customer_id = 'c3000000-0000-0000-0000-00000000000a' and effective_from = '2021-04-01'),
           (select status::text from customers where id = 'c3000000-0000-0000-0000-00000000000b'),
           (select count(*) from withdrawal_requests where status = 'open' and customer_id::text like 'c3%')$$,
  $$values (100000.00, 'active', 2::bigint)$$,
  'reopen restores capital, status and withdrawal requests');
select close_month('2021-03-01');
select mark_paid('2021-03-01');
select throws_like($$select reopen_month('2021-03-01')$$, '%already paid%', 'paid month cannot be reopened');

-- Bank details: validated, and locked for the partner once the customer is approved.
select throws_like($$select set_customer_bank('c3000000-0000-0000-0000-00000000000a', 'Vani', '123456789', 'SBIN1234567')$$,
  '%IFSC is 11 characters%', 'bad IFSC rejected');
set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000002"}';
select throws_ok($$select set_customer_bank('c3000000-0000-0000-0000-00000000000a', 'Vani', '123456789', 'SBIN0001234')$$,
  'P0001', 'You cannot change this customer', 'partner cannot change bank details after approval');

select * from finish();
rollback;
