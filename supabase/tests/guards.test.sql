-- Every refusal the money rules depend on: who may do what, closed months, locked days, closed accounts and bad
-- input. Each one is a safety rule, so each is checked by its exact message. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

insert into franchisees (id, name) values
  ('fa000000-0000-0000-0000-00000000000a', 'Guard A'), ('fa000000-0000-0000-0000-00000000000b', 'Guard B (no charges set)'),
  ('fa000000-0000-0000-0000-00000000000c', 'Guard C');
insert into franchisee_terms values ('fa000000-0000-0000-0000-00000000000a', 0), ('fa000000-0000-0000-0000-00000000000c', 0);
insert into auth.users (id, email) values
  ('aa000000-0000-0000-0000-000000000001', 'admin@guard.test'), ('aa000000-0000-0000-0000-000000000002', 'partner-a@guard.test'),
  ('aa000000-0000-0000-0000-000000000003', '9700000081@customer.exit'), ('aa000000-0000-0000-0000-000000000004', 'staff@guard.test'),
  ('aa000000-0000-0000-0000-000000000006', '9700000084@customer.exit');
insert into profiles (id, role, franchisee_id) values
  ('aa000000-0000-0000-0000-000000000001', 'admin', null), ('aa000000-0000-0000-0000-000000000002', 'franchisee', 'fa000000-0000-0000-0000-00000000000a'),
  ('aa000000-0000-0000-0000-000000000004', 'employee', null);
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('ca000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-00000000000a', 'G One', '9700000081', 'active'),
  ('ca000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-00000000000a', 'G Two', '9700000082', 'closed'),
  ('ca000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-00000000000a', 'G Three', '9700000083', 'draft'),
  ('ca000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-00000000000c', 'G Four', '9700000084', 'active'),
  ('ca000000-0000-0000-0000-000000000005', 'fa000000-0000-0000-0000-00000000000a', 'G Five', '9700000085', 'pending_approval');
insert into profiles (id, full_name, role, customer_id) values ('aa000000-0000-0000-0000-000000000003', 'G One', 'customer', 'ca000000-0000-0000-0000-000000000001');
insert into capital_movements (customer_id, effective_from, amount) values
  ('ca000000-0000-0000-0000-000000000001', '2023-01-01', 100000), ('ca000000-0000-0000-0000-000000000002', '2023-01-01', 50000),
  ('ca000000-0000-0000-0000-000000000004', '2023-01-01', 100000);
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fa000000-0000-0000-0000-00000000000a', '2023-01-10', 1000), ('fa000000-0000-0000-0000-00000000000a', '2023-02-10', 1000);
-- G Four took an emergency exit in March 2023 with results up to the 10th: Guard C's days up to then are final.
insert into emergency_exits (customer_id, status, month, through, plan, capital, carried_in, result, payout)
values ('ca000000-0000-0000-0000-000000000004', 'processed', '2023-03-01', '2023-03-10', 'variable', 100000, 0, 0, 100000);

-- Capital ledger rules (as the system, then as people).
select throws_ok($$update capital_movements set note = 'x' where customer_id = 'ca000000-0000-0000-0000-000000000001'$$,
  'P0001', 'Capital entries can''t be changed. Undo it and add it again.', 'capital rows are never edited, even by the system');
set constraints all immediate;
select throws_ok($$insert into capital_movements (customer_id, kind, effective_from, amount) values ('ca000000-0000-0000-0000-000000000004', 'correction', '2023-02-01', -200000)$$,
  'P0001', 'Capital can''t go below zero', 'capital can''t go below zero');
set constraints all deferred;
select throws_like($$insert into capital_movements (customer_id, effective_from, amount) values ('ca000000-0000-0000-0000-000000000004', '2023-03-05', 1000)$$,
  'Results up to % are final%', 'no capital can start on a locked day');
select throws_ok($$insert into daily_entries (franchisee_id, trade_date, amount) values ('fa000000-0000-0000-0000-00000000000c', '2023-03-05', 100)$$,
  'P0001', 'Results up to 10 Mar 2023 are final because a customer took an emergency exit', 'no new result on a locked day');
select throws_ok($$insert into daily_entries (franchisee_id, trade_date, amount) values ('fa000000-0000-0000-0000-00000000000b', '2023-01-05', 100)$$,
  'P0001', 'Set this partner''s trade charges before entering results', 'no results before the partner''s trade charges are set');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000004"}'; -- staff, not admin
select throws_ok($$insert into capital_movements (customer_id, kind, effective_from, amount) values ('ca000000-0000-0000-0000-000000000001', 'correction', '2023-02-01', -10)$$,
  'P0001', 'Only an Exit admin can record that', 'only an admin records anything but a deposit');
select throws_ok($$select reopen_month('2023-01-01')$$, 'P0001', 'Only an admin can reopen a month', 'staff can''t reopen');
select throws_ok($$select mark_paid('2023-01-01')$$, 'P0001', 'Only an admin can mark payouts paid', 'staff can''t mark paid');
select throws_ok($$select mark_emergency_paid((select id from emergency_exits where customer_id = 'ca000000-0000-0000-0000-000000000004'))$$,
  'P0001', 'Only an admin can mark payouts paid', 'staff can''t mark an emergency payout paid');
select ok(my_account() is null, 'someone who isn''t a customer has no customer page');

set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000001"}'; -- admin
select throws_ok($$insert into capital_movements (customer_id, received_at, amount) values ('ca000000-0000-0000-0000-000000000002', '2023-02-01 10:00+05:30', 1000)$$,
  'P0001', 'This account is closed', 'no money into a closed account');
select lives_ok($$select close_month('2023-01-01')$$, 'January 2023 closes');
select throws_ok($$select close_month('2023-01-01')$$, 'P0001', 'Jan 2023 is already closed', 'a month closes once');
select throws_ok($$delete from capital_movements where customer_id = 'ca000000-0000-0000-0000-000000000001' and effective_from = '2023-01-01'$$,
  'P0001', 'Jan 2023 is closed, so this can''t be undone', 'money in a closed month can''t be undone');
select throws_ok($$select reopen_month('2023-03-01')$$, 'P0001', 'Mar 2023 is not closed', 'only a closed month reopens');
-- February: G One withdraws 1,000 at the close, then asks again.
reset role;
insert into withdrawal_requests (customer_id, amount) values ('ca000000-0000-0000-0000-000000000001', 1000);
set local role authenticated;
set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000001"}';
select lives_ok($$select close_month('2023-02-01')$$, 'February 2023 closes with the withdrawal');
select throws_ok($$select reopen_month('2023-01-01')$$, 'P0001', 'Reopen later months first', 'months reopen newest first');
select lives_ok($$select request_withdrawal(500, 'ca000000-0000-0000-0000-000000000001')$$, 'a new withdrawal request');
select throws_ok($$select reopen_month('2023-02-01')$$, 'P0001', 'A customer settled this month has a new withdrawal request. Cancel it first.',
  'can''t reopen under a new request');
select lives_ok($$select cancel_withdrawal('ca000000-0000-0000-0000-000000000001')$$, 'request cancelled');
select throws_ok($$select reopen_month('2023-02-01')$$, 'P0001', 'An emergency exit was paid after this month, so it can''t be reopened',
  'can''t reopen once a later emergency exit is paid');
select lives_ok($$select mark_emergency_paid((select id from emergency_exits where customer_id = 'ca000000-0000-0000-0000-000000000004'))$$, 'admin marks it paid');
select isnt((select paid_at from emergency_exits where customer_id = 'ca000000-0000-0000-0000-000000000004'), null, 'emergency payout marked paid');

-- Who may act on which customer: Guard A's partner can't touch Guard C's customer.
set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000002"}';
select throws_ok($$select cancel_withdrawal('ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot change this account', 'not your customer: withdrawal');
select throws_ok($$select request_emergency_exit(null, 'ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot change this account', 'not your customer: emergency');
select throws_ok($$select cancel_emergency_exit('ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot change this account', 'not your customer: cancel emergency');
select throws_ok($$select emergency_figures('ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot see this customer', 'not your customer: figures');
select throws_ok($$select create_signing_link('ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot change this customer', 'not your customer: signing link');
select throws_ok($$select link_customer_login('aa000000-0000-0000-0000-000000000006', 'ca000000-0000-0000-0000-000000000004')$$, 'P0001', 'You cannot change this customer', 'not your customer: login');
select throws_ok($$select request_emergency_exit(null, 'ca000000-0000-0000-0000-000000000002')$$, 'P0001', 'This account is not active', 'closed account: no emergency exit');
select throws_ok($$select request_withdrawal(100, 'ca000000-0000-0000-0000-000000000002')$$, 'P0001', 'This account is not active', 'closed account: no withdrawal');
select throws_ok($$update customers set cap_pct = 9 where id = 'ca000000-0000-0000-0000-000000000003'$$, 'P0001', 'Only Exit staff can change customer terms', 'a partner can''t change terms');

-- The customer's own requests.
set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000003"}';
select throws_ok($$select request_withdrawal(0)$$, 'P0001', 'Enter an amount', 'a withdrawal needs an amount');
select lives_ok($$select request_emergency_exit('Surgery')$$, 'customer asks for an emergency exit');
select lives_ok($$select cancel_emergency_exit()$$, 'and cancels it');
select is((select status::text from emergency_exits where customer_id = 'ca000000-0000-0000-0000-000000000001'), 'cancelled', 'request cancelled');

-- Admin: moving a customer to another partner recomputes both; a name change after signing means signing again.
set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000001"}';
select lives_ok($$update customers set franchisee_id = 'fa000000-0000-0000-0000-00000000000c' where id = 'ca000000-0000-0000-0000-000000000003'$$, 'customer moved to another partner');
update customers set full_name = 'G Five Renamed' where id = 'ca000000-0000-0000-0000-000000000005';
select is((select status from customers where id = 'ca000000-0000-0000-0000-000000000005'), 'draft'::customer_status, 'renamed after signing: sign again');
select throws_ok($$select set_customer_bank('ca000000-0000-0000-0000-000000000003', 'AB', '123456789', 'SBIN0001234')$$, 'P0001', 'Enter the account holder''s name as the bank has it', 'bank holder name checked');
select throws_ok($$select set_customer_bank('ca000000-0000-0000-0000-000000000003', 'G Three', '12ab', 'SBIN0001234')$$, 'P0001', 'Account number is 9 to 18 digits', 'account number checked');
select throws_ok($$select set_customer_pii('ca000000-0000-0000-0000-000000000003', null, 'abcd')$$, 'P0001', 'Aadhaar must be the last 4 digits', 'Aadhaar checked');
select lives_ok($$select link_customer_login('aa000000-0000-0000-0000-000000000006', 'ca000000-0000-0000-0000-000000000004')$$, 'admin links a login to an active customer');
select throws_ok($$select link_customer_login('aa000000-0000-0000-0000-000000000006', 'ca000000-0000-0000-0000-000000000002')$$, 'P0001', 'Logins are for approved customers only', 'no login for a closed account');
select is(customer_login_id('ca000000-0000-0000-0000-000000000004'), 'aa000000-0000-0000-0000-000000000006'::uuid, 'staff find the customer''s login');
select is(kyc_customer('ca000000-0000-0000-0000-000000000004/pan-1.jpg'), 'ca000000-0000-0000-0000-000000000004'::uuid, 'a KYC file path names its customer');
select is(kyc_customer('../etc/passwd'), null, 'a path that isn''t a customer''s names nobody');

-- Signing links: bad token, expired link, too-short name.
reset role;
insert into agreements (customer_id, template_version, sign_token, token_expires_at) values
  ('ca000000-0000-0000-0000-000000000003', 1, 'da000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('ca000000-0000-0000-0000-000000000005', 1, 'da000000-0000-0000-0000-000000000002', now() + interval '1 day');
set local role anon;
select throws_ok($$select sign_agreement('da000000-0000-0000-0000-0000000000ff', 'G Three', 'data:image/png;base64,iVBORw0KGgo=')$$, 'P0001', 'This signing link is not valid', 'unknown link');
select throws_ok($$select sign_agreement('da000000-0000-0000-0000-000000000001', 'G Three', 'data:image/png;base64,iVBORw0KGgo=')$$, 'P0001', 'This signing link has expired. Ask your partner for a new one.', 'expired link');
select throws_ok($$select sign_agreement('da000000-0000-0000-0000-000000000002', 'ab', 'data:image/png;base64,iVBORw0KGgo=')$$, 'P0001', 'Type your full name to sign', 'name too short');
-- Website form checks.
select throws_ok($$select request_consultation('Asha', '9800000001', 'not-an-email', 'Stock Advisory', 'Guntur', null)$$, 'P0001', 'Enter a valid email', 'email checked');
select throws_ok($$select request_consultation('Asha', '9800000001', '', '', 'Guntur', null)$$, 'P0001', 'Choose what you are interested in', 'interest required');
select throws_ok($$select request_consultation('Asha', '9800000001', '', 'Stock Advisory', 'Guntur', repeat('x', 2001))$$, 'P0001', 'Please keep the message under 2,000 characters', 'message length checked');

-- Changing a password is only for someone logged in.
reset role;
set local request.jwt.claims = '{}';
select throws_ok($$select password_changed()$$, 'P0001', 'Log in first', 'password_changed needs a login');

select * from finish();
rollback;
