-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into franchisees (id, name) values
  ('f3000000-0000-0000-0000-000000000001', 'Enc Partner A'), ('f3000000-0000-0000-0000-000000000002', 'Enc Partner B');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c3000000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 'Enc One', '1', 'draft'),
  ('c3000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 'Enc Two', '2', 'active');
insert into auth.users (id, email) values
  ('a3000000-0000-0000-0000-000000000001', 'ea@test'), ('a3000000-0000-0000-0000-000000000002', 'eb@test'), ('a3000000-0000-0000-0000-000000000003', 'es@test');
insert into profiles (id, role, franchisee_id) values
  ('a3000000-0000-0000-0000-000000000001', 'franchisee', 'f3000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000002', 'franchisee', 'f3000000-0000-0000-0000-000000000002'),
  ('a3000000-0000-0000-0000-000000000003', 'employee', null);

-- Partner A records PAN and Aadhaar for their draft customer.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001"}';
select lives_ok($$select set_customer_pii('c3000000-0000-0000-0000-000000000001', 'encpa1234q', '9876')$$, 'partner sets PAN and Aadhaar');
select results_eq($$select pan, aadhaar_last4 from customer_pii('c3000000-0000-0000-0000-000000000001')$$,
  $$values ('ENCPA1234Q', '9876')$$, 'partner reads them back (PAN upper-cased)');
select throws_ok($$select pan_enc from customers$$, '42501', null, 'encrypted column cannot be selected');
select throws_ok($$select pii_key()$$, '42501', null, 'the key cannot be fetched');
select throws_ok($$select pii_decrypt('\x00'::bytea)$$, '42501', null, 'decrypt cannot be called directly');
select throws_ok($$select set_customer_pii('c3000000-0000-0000-0000-000000000002', 'ABCDE1111A', '1111')$$,
  'P0001', 'You cannot change this customer', 'partner cannot change PII of an active customer');
select throws_ok($$select set_customer_pii('c3000000-0000-0000-0000-000000000001', 'BAD', '1')$$,
  'P0001', 'PAN is 5 letters, 4 digits, 1 letter', 'PAN format checked');
select ok(not pan_available('ENCPA1234Q') and pan_available('NEWPA1234Q'), 'pan_available spots an existing PAN by fingerprint');

-- Partner B sees nothing of A's customer.
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000002"}';
select is((select count(*) from customer_pii('c3000000-0000-0000-0000-000000000001')), 0::bigint, 'other partner gets no PII');

-- Staff: duplicate PAN refused.
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000003"}';
select throws_ok($$select set_customer_pii('c3000000-0000-0000-0000-000000000002', 'ENCPA1234Q', '1111')$$,
  'P0001', 'Another customer already has this PAN.', 'duplicate PAN refused');
reset role;

-- At rest: ciphertext only, decryptable with the key, nothing plaintext in the activity log.
select ok(position('ENCPA1234Q' in encode(pan_enc, 'escape')) = 0 and position('9876' in encode(aadhaar_enc, 'escape')) = 0,
  'stored values are not plaintext') from customers where id = 'c3000000-0000-0000-0000-000000000001';
select is(pii_decrypt(pan_enc), 'ENCPA1234Q', 'stored PAN decrypts with the key') from customers where id = 'c3000000-0000-0000-0000-000000000001';
select is((select count(*) from audit_log where (coalesce(new, old))::text ~ 'ENCPA1234Q|"9876"'), 0::bigint, 'activity log holds no plaintext PAN or Aadhaar');

-- Signed agreement: encrypted at rest, readable through signed_agreement() by the right people only.
insert into agreements (customer_id, template_version, rendered_html_enc, signer_name, signed_at)
values ('c3000000-0000-0000-0000-000000000001', 1, pii_encrypt('<p>PAN ENCPA1234Q</p>'), 'Enc One', now());
select ok((select position('ENCPA1234Q' in encode(rendered_html_enc, 'escape')) = 0 from agreements where customer_id = 'c3000000-0000-0000-0000-000000000001'),
  'agreement text encrypted at rest');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000003"}';
select ok(signed_agreement('c3000000-0000-0000-0000-000000000001')->>'html' like '%ENCPA1234Q%', 'staff can read the signed agreement');
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000002"}';
select ok(signed_agreement('c3000000-0000-0000-0000-000000000001') is null, 'other partner cannot read it');

select * from finish();
rollback;
