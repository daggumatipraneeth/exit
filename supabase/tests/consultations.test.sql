-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into franchisees (id, name) values ('f5000000-0000-0000-0000-000000000001', 'Consult Partner'), ('f5000000-0000-0000-0000-000000000002', 'Other Partner');
insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'admin5@test'), ('a5000000-0000-0000-0000-000000000002', 'guntur5@test'),
  ('a5000000-0000-0000-0000-000000000003', 'anyoffice5@test'), ('a5000000-0000-0000-0000-000000000004', 'partner5@test');
insert into profiles (id, role, office, franchisee_id) values
  ('a5000000-0000-0000-0000-000000000001', 'admin', null, null),
  ('a5000000-0000-0000-0000-000000000002', 'employee', 'Guntur', null),
  ('a5000000-0000-0000-0000-000000000003', 'employee', null, null),
  ('a5000000-0000-0000-0000-000000000004', 'franchisee', null, 'f5000000-0000-0000-0000-000000000001');
select throws_ok($$update profiles set office = 'Mumbai' where id = 'a5000000-0000-0000-0000-000000000002'$$, '23514', null, 'staff office must be a real office');

-- The public website (no login) submits.
set local role anon;
select lives_ok($$select request_consultation('Ravi T5', '+91 98480 00001', '', 'Equity trading', 'Guntur', 'Call after 5')$$, 'visitor can request a call back');
select lives_ok($$select request_consultation('Sita T5', '9848000002', 'sita@example.com', 'Mutual funds', 'Hyderabad', null)$$, 'second office');
select lives_ok($$select request_consultation('Bot T5', '9848000003', '', 'Equity trading', 'Guntur', 'spam', 'http://spam')$$, 'bot trap pretends success');
select throws_ok($$select request_consultation('R', '9848000004', '', 'Equity trading', 'Guntur', null)$$, 'P0001', 'Please enter your name', 'name checked');
select throws_ok($$select request_consultation('Ravi T5', '12345', '', 'Equity trading', 'Guntur', null)$$, 'P0001', 'Enter a valid phone number', 'phone checked');
select throws_ok($$select request_consultation('Ravi T5', '9848000004', '', 'Equity trading', 'Mumbai', null)$$, 'P0001', 'Choose an office', 'office checked');
select lives_ok($$select request_consultation('Ravi T5', '9848000001', '', 'Equity trading', 'Guntur', null)$$, 'repeats are allowed, same number without +91');
select lives_ok($$select request_consultation('Ravi T5', '09848000001', '', 'Equity trading', 'Guntur', null)$$, 'third request');
select throws_ok($$select request_consultation('Ravi T5', '9848000001', '', 'Equity trading', 'Guntur', null)$$, 'P0001',
  'We already have your request. Our team will call you soon.', 'fourth request from one phone in an hour is refused');
select throws_ok($$select * from consultation_requests$$, '42501', null, 'visitors cannot read requests');
reset role;
select is((select count(*) from consultation_requests where name = 'Bot T5'), 0::bigint, 'bot request not stored');

-- Each office sees its own; all-office staff and admins see everything; partners see none.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002"}';
select results_eq($$select distinct office from consultation_requests where name like '% T5'$$, $$values ('Guntur'::text)$$, 'Guntur staff see only Guntur');
update consultation_requests set status = 'contacted', notes = 'called' where name = 'Sita T5';
select throws_ok($$update consultation_requests set name = 'Changed' where name = 'Ravi T5'$$, '42501', null, 'the request itself cannot be edited');
select lives_ok($$update consultation_requests set status = 'contacted', notes = 'Meeting Monday', handled_by = auth.uid(), handled_at = now() where name = 'Ravi T5'$$, 'staff mark contacted with a note');
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000003"}';
select is((select count(*) from consultation_requests where name like '% T5'), 4::bigint, 'all-office staff see every office');
select is((select status from consultation_requests where name = 'Sita T5'), 'new', 'Guntur staff could not touch a Hyderabad request');
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000004"}';
select is((select count(*) from consultation_requests), 0::bigint, 'partners see no requests until one is allocated');

-- Staff allocate; the partner then sees and updates it, but can't pass it on.
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002"}';
select lives_ok($$update consultation_requests set franchisee_id = 'f5000000-0000-0000-0000-000000000001' where name = 'Ravi T5'$$, 'staff allocate to a partner');
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000004"}';
select results_eq($$select distinct name from consultation_requests$$, $$values ('Ravi T5'::text)$$, 'partner sees only what is allocated to them');
select lives_ok($$update consultation_requests set status = 'closed', notes = 'Opened account' where name = 'Ravi T5'$$, 'partner updates status and notes');
select throws_ok($$update consultation_requests set franchisee_id = 'f5000000-0000-0000-0000-000000000002' where name = 'Ravi T5'$$, '42501', null, 'partner cannot pass a request to another partner');
select throws_ok($$update consultation_requests set franchisee_id = null where name = 'Ravi T5'$$, '42501', null, 'partner cannot drop a request');
reset role;
select is((select count(*) from consultation_requests where name = 'Ravi T5' and franchisee_id = 'f5000000-0000-0000-0000-000000000001' and status = 'closed'), 3::bigint,
  'partner could not hand requests on or drop them');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000004"}';
select throws_ok($$update consultation_requests set name = 'x' where name = 'Ravi T5'$$, '42501', null, 'partner cannot edit the request itself');
select is((select count(*) from consultation_requests where name = 'Sita T5'), 0::bigint, 'partner does not see unallocated requests');
reset role;

-- Staff add phone-in requests for their own office; partners can't add any.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002"}';
select lives_ok($$insert into consultation_requests (name, phone, interest, office, franchisee_id)
  values ('Walk-in T5', '9848011111', 'Stock Advisory', 'Guntur', 'f5000000-0000-0000-0000-000000000001')$$, 'Guntur staff add a request and allocate it');
select throws_ok($$insert into consultation_requests (name, phone, interest, office) values ('Other T5', '9848011112', 'Stock Advisory', 'Hyderabad')$$,
  '42501', null, 'Guntur staff cannot add a Hyderabad request');
select throws_ok($$insert into consultation_requests (name, phone, interest, office, status) values ('Odd T5', '9848011113', 'Stock Advisory', 'Guntur', 'closed')$$,
  '42501', null, 'status cannot be set when adding');
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000004"}';
select throws_ok($$insert into consultation_requests (name, phone, interest, office) values ('Self T5', '9848011114', 'Stock Advisory', 'Guntur')$$,
  '42501', null, 'partners cannot add requests');
reset role;

select * from finish();
rollback;
