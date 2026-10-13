-- Admin review: rejecting needs a reason, and changing the terms after signing means signing again.
-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into franchisees (id, name) values ('f9200000-0000-0000-0000-000000000001', 'Review Partner');
insert into auth.users (id, email) values ('a9200000-0000-0000-0000-000000000001', 'admin@review.test');
insert into profiles (id, role) values ('a9200000-0000-0000-0000-000000000001', 'admin');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c9200000-0000-0000-0000-000000000001', 'f9200000-0000-0000-0000-000000000001', 'Signed One', '9700000021', 'pending_approval'),
  ('c9200000-0000-0000-0000-000000000002', 'f9200000-0000-0000-0000-000000000001', 'Signed Two', '9700000022', 'pending_approval'),
  ('c9200000-0000-0000-0000-000000000003', 'f9200000-0000-0000-0000-000000000001', 'Signed Three', '9700000023', 'pending_approval');
insert into capital_movements (customer_id, effective_from, amount) values
  ('c9200000-0000-0000-0000-000000000001', '2020-01-01', 100000), ('c9200000-0000-0000-0000-000000000002', '2020-01-01', 100000),
  ('c9200000-0000-0000-0000-000000000003', '2020-01-01', 100000);
insert into agreements (customer_id, template_version, signed_at) values
  ('c9200000-0000-0000-0000-000000000001', 1, now()), ('c9200000-0000-0000-0000-000000000002', 1, now()),
  ('c9200000-0000-0000-0000-000000000003', 1, now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"a9200000-0000-0000-0000-000000000001"}';

-- Reject with a reason; reopening clears it.
select throws_ok($$update customers set status = 'rejected' where id = 'c9200000-0000-0000-0000-000000000001'$$,
  'P0001', 'Give a reason for rejecting', 'reject needs a reason');
select lives_ok($$update customers set status = 'rejected', reject_reason = 'PAN photo unreadable' where id = 'c9200000-0000-0000-0000-000000000001'$$,
  'reject with a reason');
select is((select reject_reason from customers where id = 'c9200000-0000-0000-0000-000000000001'), 'PAN photo unreadable', 'reason kept');
update customers set status = 'draft' where id = 'c9200000-0000-0000-0000-000000000001';
select is((select reject_reason from customers where id = 'c9200000-0000-0000-0000-000000000001'), null, 'reopening clears the reason');

-- After signing, a change to the plan or capital sends the customer back to sign again.
update customers set plan = 'fixed' where id = 'c9200000-0000-0000-0000-000000000002';
select is((select status from customers where id = 'c9200000-0000-0000-0000-000000000002'), 'draft'::customer_status, 'plan change after signing: sign again');
insert into capital_movements (customer_id, received_at, amount) values ('c9200000-0000-0000-0000-000000000003', '2020-01-31 10:00+05:30', 50000);
select is((select status from customers where id = 'c9200000-0000-0000-0000-000000000003'), 'draft'::customer_status, 'capital change after signing: sign again');

-- Saving without a real change, and changes once active, leave the status alone.
update customers set status = 'pending_approval' where id = 'c9200000-0000-0000-0000-000000000002';
update customers set plan = 'fixed', address = 'New address' where id = 'c9200000-0000-0000-0000-000000000002';
select is((select status from customers where id = 'c9200000-0000-0000-0000-000000000002'), 'pending_approval'::customer_status, 'no term change: still awaiting approval');
select lives_ok($$update customers set status = 'active' where id = 'c9200000-0000-0000-0000-000000000002'$$, 'admin approves');
insert into capital_movements (customer_id, received_at, amount) values ('c9200000-0000-0000-0000-000000000002', '2020-02-29 10:00+05:30', 100000);
select is((select status from customers where id = 'c9200000-0000-0000-0000-000000000002'), 'active'::customer_status, 'top-up of an active customer stays active');
update customers set plan = 'variable' where id = 'c9200000-0000-0000-0000-000000000002';
select is((select status from customers where id = 'c9200000-0000-0000-0000-000000000002'), 'active'::customer_status, 'plan change of an active customer stays active');

select * from finish();
rollback;
