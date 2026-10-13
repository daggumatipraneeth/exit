-- Emergency exit: paid at once on the results entered so far; the partner's days up to then become final.
--   variable: capital + this month's result + carried loss, never below 0      fixed: capital in full
-- It always applies to the current IST month, so dates here are relative to today. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create temp table t as select date_trunc('month', today_ist())::date as m, (date_trunc('month', today_ist()) - interval '1 month')::date as p;
grant select on t to authenticated;

insert into auth.users (id, email) values
  ('ae000000-0000-0000-0000-000000000001', 'admin@emergency.test'), ('ae000000-0000-0000-0000-000000000002', '9700000052@customer.exit'),
  ('ae000000-0000-0000-0000-000000000003', 'partner@emergency.test');
insert into franchisees (id, name) values
  ('fe000000-0000-0000-0000-00000000000a', 'Em A'), ('fe000000-0000-0000-0000-00000000000b', 'Em B'),
  ('fe000000-0000-0000-0000-00000000000c', 'Em C'), ('fe000000-0000-0000-0000-00000000000d', 'Em D'),
  ('fe000000-0000-0000-0000-00000000000e', 'Em G'), ('fe000000-0000-0000-0000-00000000000f', 'Em H'),
  ('fe000000-0000-0000-0000-000000000010', 'Em K');
insert into franchisee_terms select id, 0 from franchisees where name like 'Em %';
insert into profiles (id, role, franchisee_id) values
  ('ae000000-0000-0000-0000-000000000001', 'admin', null), ('ae000000-0000-0000-0000-000000000003', 'franchisee', 'fe000000-0000-0000-0000-00000000000b');
insert into customers (id, franchisee_id, full_name, phone, plan, status) values
  ('ce000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-00000000000a', 'V1 profit', '9700000051', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000011', 'fe000000-0000-0000-0000-00000000000a', 'A2 stays', '9700000061', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000002', 'fe000000-0000-0000-0000-00000000000b', 'V2 loss', '9700000052', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000003', 'fe000000-0000-0000-0000-00000000000c', 'F1 fixed', '9700000053', 'fixed', 'active'),
  ('ce000000-0000-0000-0000-000000000004', 'fe000000-0000-0000-0000-00000000000d', 'V3 carried', '9700000054', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000005', 'fe000000-0000-0000-0000-00000000000e', 'V5 wiped', '9700000055', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000006', 'fe000000-0000-0000-0000-00000000000f', 'V6 pending', '9700000056', 'variable', 'active'),
  ('ce000000-0000-0000-0000-000000000007', 'fe000000-0000-0000-0000-000000000010', 'K1 exited', '9700000057', 'variable', 'closed');
insert into profiles (id, full_name, role, customer_id) values ('ae000000-0000-0000-0000-000000000002', 'V2 loss', 'customer', 'ce000000-0000-0000-0000-000000000002');
insert into capital_movements (customer_id, effective_from, amount)
select id, (select p from t), case when full_name = 'V5 wiped' then 1000 else 100000 end from customers where full_name ~ '^(V|A2|F1|K1)';
-- V6 also sends 50,000 today at 13:00: it counts from tomorrow, so it's still pending.
insert into capital_movements (customer_id, received_at, amount)
values ('ce000000-0000-0000-0000-000000000006', ((select today_ist()) + time '13:00') at time zone 'Asia/Kolkata', 50000);

-- Last month: V3 loses 8,000 (carried forward). K1 took an emergency exit last month and must not be settled again.
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fe000000-0000-0000-0000-00000000000d', (select p from t), -8000), ('fe000000-0000-0000-0000-000000000010', (select p from t), 500);
insert into emergency_exits (customer_id, status, month, through, plan, capital, carried_in, result, payout)
values ('ce000000-0000-0000-0000-000000000007', 'processed', (select p from t), (select p from t), 'variable', 100000, 0, 500, 100500);
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000001"}';
select lives_ok($$select close_month((select p from t))$$, 'admin closes last month');
reset role;
select is((select count(*)::int from settlements where customer_id = 'ce000000-0000-0000-0000-000000000007'), 0,
  'month close leaves out a customer already paid by an emergency exit');
select is(carried_loss('ce000000-0000-0000-0000-000000000004'), -8000.00, 'V3 carries a loss of 8,000');

-- This month, on the 1st (each partner has only these customers):
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fe000000-0000-0000-0000-00000000000a', (select m from t), 4000),   -- V1 and A2: 2,000 each
  ('fe000000-0000-0000-0000-00000000000b', (select m from t), -5000),  -- V2: -5,000
  ('fe000000-0000-0000-0000-00000000000c', (select m from t), -5000),  -- F1 (fixed): -5,000
  ('fe000000-0000-0000-0000-00000000000d', (select m from t), 3000),   -- V3: +3,000
  ('fe000000-0000-0000-0000-00000000000e', (select m from t), -5000),  -- V5 (capital 1,000): -5,000
  ('fe000000-0000-0000-0000-00000000000f', (select m from t), 1000);   -- V6: +1,000
insert into withdrawal_requests (customer_id, amount) values ('ce000000-0000-0000-0000-000000000002', 10000);

-- The customer asks; their partner can't ask twice; nobody but an admin processes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000002"}';
select lives_ok($$select request_emergency_exit('Medical emergency')$$, 'customer requests an emergency exit');
select is((emergency_figures('ce000000-0000-0000-0000-000000000002')->>'payout')::numeric, 95000.00, 'customer sees what they would get: 1,00,000 - 5,000');
select throws_ok($$select process_emergency_exit('ce000000-0000-0000-0000-000000000002')$$, 'P0001', 'Only an admin can process an emergency exit', 'customer can''t process it');
set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000003"}';
select throws_ok($$select request_emergency_exit(null, 'ce000000-0000-0000-0000-000000000002')$$, 'P0001', 'An emergency exit has already been requested', 'one request at a time');

set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000001"}';
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000001'), 102000.00, 'variable profit: 1,00,000 + 2,000');
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000002'), 95000.00, 'variable loss: 1,00,000 - 5,000');
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000003'), 100000.00, 'fixed plan: capital in full, nothing for the part-month');
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000004'), 95000.00, 'carried loss comes off too: 1,00,000 - 8,000 + 3,000');
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000005'), 0.00, 'loss bigger than capital: pays 0, the customer owes nothing');
select is(process_emergency_exit('ce000000-0000-0000-0000-000000000006'), 151000.00, 'a pending deposit is paid back too: 1,50,000 + 1,000');

select results_eq($$select status::text, reason, result, carried_in from emergency_exits where customer_id = 'ce000000-0000-0000-0000-000000000002'$$,
  $$values ('processed', 'Medical emergency', -5000.00, 0.00)$$, 'the request becomes the processed exit, reason kept');
select is((select status from withdrawal_requests where customer_id = 'ce000000-0000-0000-0000-000000000002'), 'cancelled', 'open withdrawal cancelled');
select is((select status from customers where id = 'ce000000-0000-0000-0000-000000000006'), 'closed'::customer_status, 'account closed');
select is(total_capital('ce000000-0000-0000-0000-000000000006'), 0.00, 'no capital left, pending deposit included');
select is(capital_on('ce000000-0000-0000-0000-000000000006', (select m from t)), 100000.00, 'capital still counted on the days paid out');
set constraints all immediate; -- run the commit-time check now: capital never below zero on any day
select pass('capital never goes below zero');
select throws_ok($$select process_emergency_exit('ce000000-0000-0000-0000-000000000001')$$, 'P0001', 'This account is not active', 'can''t exit twice');

-- The lock: V1's partner's days up to the exit are final.
reset role;
select throws_like($$update daily_entries set amount = 4001 where franchisee_id = 'fe000000-0000-0000-0000-00000000000a'$$,
  'Results up to % are final because a customer took an emergency exit', 'paid-out days can''t be changed');
select throws_like($$insert into capital_movements (customer_id, effective_from, amount) values ('ce000000-0000-0000-0000-000000000011', (select m from t), 5000)$$,
  'Results up to % are final%', 'no capital can start on a paid-out day');
update customers set cap_pct = 1 where id = 'ce000000-0000-0000-0000-000000000011'; -- would change the 1st's split if it were recomputed
select results_eq($$select customer_id, credited from customer_days where franchisee_id = 'fe000000-0000-0000-0000-00000000000a' order by 1$$,
  $$values ('ce000000-0000-0000-0000-000000000001'::uuid, 2000.00), ('ce000000-0000-0000-0000-000000000011', 2000.00)$$,
  'paid-out days stay exactly as paid after other changes');

-- The customer's page shows it; the bank file pays it once.
set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000002"}';
select is((select (p->>'amount')::numeric from json_array_elements(my_account()->'payouts') p where (p->>'emergency')::boolean), 95000.00,
  'customer sees the emergency payout');
set local request.jwt.claims = '{"sub":"ae000000-0000-0000-0000-000000000001"}';
select results_eq($$select amount, customer from emergency_payout_file((select id from emergency_exits where customer_id = 'ce000000-0000-0000-0000-000000000002'))$$,
  $$values (95000.00, 'V2 loss')$$, 'emergency payout file has the one payment');
select is((select count(*)::int from emergency_payout_file((select id from emergency_exits where customer_id = 'ce000000-0000-0000-0000-000000000005'))), 0,
  'nothing to pay, no line in the file');

select * from finish();
rollback;
