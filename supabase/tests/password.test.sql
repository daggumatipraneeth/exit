-- Temporary passwords: after changing it, password_changed() clears the mark and logs the change.
-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_app_meta_data) values
  ('a9000000-0000-0000-0000-000000000001', 'temp@pw.test', '{"provider":"email","must_change_password":true}');
insert into profiles (id, full_name, role) values ('a9000000-0000-0000-0000-000000000001', 'Temp Person', 'employee');

set local role anon;
select throws_ok($$select password_changed()$$, '42501', null, 'not callable without logging in');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-0000-0000-000000000001"}';
select lives_ok($$select password_changed()$$, 'the person reports their own password change');

reset role;
select is((select raw_app_meta_data from auth.users where id = 'a9000000-0000-0000-0000-000000000001'),
  '{"provider":"email"}'::jsonb, 'temporary-password mark cleared, rest of app_metadata kept');
select is((select count(*)::int from audit_log where op = 'PASSWORD' and actor = 'a9000000-0000-0000-0000-000000000001'
             and new->>'id' = 'a9000000-0000-0000-0000-000000000001'), 1, 'activity log records who changed their own password');

select * from finish();
rollback;
