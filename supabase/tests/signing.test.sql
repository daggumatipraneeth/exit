-- The name typed when signing must be the customer's name (case, spacing and punctuation don't matter).
-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into franchisees (id, name) values ('f9100000-0000-0000-0000-000000000001', 'Sign Partner');
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c9100000-0000-0000-0000-000000000001', 'f9100000-0000-0000-0000-000000000001', 'Ravi K. Teja', '9700000011', 'awaiting_signature');
insert into agreements (customer_id, template_version, sign_token) values
  ('c9100000-0000-0000-0000-000000000001', 1, 'd9100000-0000-0000-0000-000000000001');

set local role anon;
select throws_ok($$select sign_agreement('d9100000-0000-0000-0000-000000000001', 'Someone Else', 'data:image/png;base64,iVBORw0KGgo=')$$,
  'P0001', 'Type your name as on your PAN card: Ravi K. Teja', 'a different name is refused');
select lives_ok($$select sign_agreement('d9100000-0000-0000-0000-000000000001', '  ravi k teja ', 'data:image/png;base64,iVBORw0KGgo=')$$,
  'same name in another case and without the dot signs');
reset role;
select is((select status from customers where id = 'c9100000-0000-0000-0000-000000000001'), 'pending_approval'::customer_status, 'signed');

select * from finish();
rollback;
