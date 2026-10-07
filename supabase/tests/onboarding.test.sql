-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into franchisees (id, name) values ('f1000000-0000-0000-0000-000000000001', 'Onboard Partner');
insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'p@test'), ('b1000000-0000-0000-0000-000000000002', 'a@test');
insert into profiles (id, role, franchisee_id) values
  ('b1000000-0000-0000-0000-000000000001', 'franchisee', 'f1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002', 'admin', null);
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Sita <Devi>', '9', 'draft');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001"}';

select throws_like($$select create_signing_link('c1000000-0000-0000-0000-000000000001')$$,
  '%PAN number, Aadhaar last 4 digits, capital, PAN card photo, Aadhaar front photo, Aadhaar back photo%', 'link needs complete KYC');

select set_customer_pii('c1000000-0000-0000-0000-000000000001', 'ABCDE9999Z', '4321');
insert into customer_capital values ('c1000000-0000-0000-0000-000000000001', '2026-01-01', 250000);
insert into customer_documents (customer_id, kind, path) values
  ('c1000000-0000-0000-0000-000000000001', 'pan', 'c1000000-0000-0000-0000-000000000001/pan'),
  ('c1000000-0000-0000-0000-000000000001', 'aadhaar_front', 'c1000000-0000-0000-0000-000000000001/aadhaar_front'),
  ('c1000000-0000-0000-0000-000000000001', 'aadhaar_back', 'c1000000-0000-0000-0000-000000000001/aadhaar_back');

select lives_ok($$select create_signing_link('c1000000-0000-0000-0000-000000000001')$$, 'partner creates link once KYC is complete');
select is((select status from customers where id = 'c1000000-0000-0000-0000-000000000001'), 'awaiting_signature'::customer_status, 'status moves to awaiting signature');
select throws_ok($$insert into agreements (customer_id, template_version) values ('c1000000-0000-0000-0000-000000000001', 1)$$,
  '42501', null, 'partners cannot create agreements directly');

-- The customer signs without logging in.
reset role;
create temp table t as select sign_token from agreements where customer_id = 'c1000000-0000-0000-0000-000000000001';
grant select on t to anon;
set local role anon;
set local request.headers = '{"x-forwarded-for":"203.0.113.9, 10.0.0.1","user-agent":"test-agent"}';
select ok((select get_agreement(sign_token)->>'html' from t) like '%Sita &lt;Devi&gt;%₹2,50,000%', 'agreement renders escaped name and Indian-format capital');
select throws_ok($$select sign_agreement((select sign_token from t), 'Sita Devi', 'not-an-image')$$, 'P0001', 'Draw your signature to sign', 'signature required');
select lives_ok($$select sign_agreement((select sign_token from t), 'Sita Devi', 'data:image/png;base64,iVBORw0KGgo=')$$, 'customer signs');
select throws_ok($$select sign_agreement((select sign_token from t), 'Sita Devi', 'data:image/png;base64,iVBORw0KGgo=')$$, 'P0001', 'This agreement is already signed', 'cannot sign twice');
select is((select get_agreement(sign_token)->>'html' from t), null, 'agreement text hidden after signing');
reset role;
select results_eq(
  $$select signer_ip, signer_user_agent, length(html_sha256), status::text from agreements a join customers c on c.id = a.customer_id
    where a.customer_id = 'c1000000-0000-0000-0000-000000000001'$$,
  $$values ('203.0.113.9', 'test-agent', 64, 'pending_approval')$$,
  'evidence recorded and customer awaits approval');

-- Approval: admin only (employee case is in payout.test.sql), and only after signing.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000002"}';
select lives_ok($$update customers set status = 'active' where id = 'c1000000-0000-0000-0000-000000000001'$$, 'admin approves signed customer');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'Unsigned', '8', 'draft');
select throws_ok($$update customers set status = 'active' where id = 'c1000000-0000-0000-0000-000000000002'$$,
  'P0001', 'The customer has not signed the agreement yet', 'cannot approve without signature');

-- A deactivated partner sees nothing.
update franchisees set active = false where id = 'f1000000-0000-0000-0000-000000000001';
set local request.jwt.claims = '{"sub":"b1000000-0000-0000-0000-000000000001"}';
select is((select count(*) from customers), 0::bigint, 'inactive partner sees no customers');

select * from finish();
rollback;
