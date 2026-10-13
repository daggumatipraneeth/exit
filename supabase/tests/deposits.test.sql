-- Deposits: the 12:00 IST cut-off, pro-rated buckets and the daily split by that day's capital.
-- Every expected figure is worked out by hand in the comment beside it. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Cut-off: before 12:00 IST → next day; from 12:00 → the day after.
select is(effective_date('2025-09-15 11:59:59+05:30'), '2025-09-16'::date, '11:59:59 counts from the next day');
select is(effective_date('2025-09-15 12:00:00+05:30'), '2025-09-17'::date, '12:00:00 counts from the day after');
select is(effective_date('2025-09-15 06:29:59+00'), '2025-09-16'::date, 'a UTC time is read in IST (06:29:59 UTC = 11:59:59 IST)');
select is(effective_date('2025-09-30 06:00+05:30'), '2025-10-01'::date, 'last morning of the month counts from the 1st');
select is(effective_date('2025-09-30 13:00+05:30'), '2025-10-02'::date, 'last afternoon of the month counts from the 2nd');

insert into franchisees (id, name) values
  ('fd000000-0000-0000-0000-000000000001', 'Dep Cap'), ('fd000000-0000-0000-0000-000000000002', 'Dep Split'),
  ('fd000000-0000-0000-0000-000000000003', 'Dep Room'), ('fd000000-0000-0000-0000-000000000004', 'Dep Feb');
insert into franchisee_terms values
  ('fd000000-0000-0000-0000-000000000001', 0), ('fd000000-0000-0000-0000-000000000002', 0),
  ('fd000000-0000-0000-0000-000000000003', 0), ('fd000000-0000-0000-0000-000000000004', 0);
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('cd000000-0000-0000-0000-00000000000a', 'fd000000-0000-0000-0000-000000000001', 'Before noon', '1', 'active'),
  ('cd000000-0000-0000-0000-00000000000b', 'fd000000-0000-0000-0000-000000000001', 'After noon', '2', 'active'),
  ('cd000000-0000-0000-0000-00000000000c', 'fd000000-0000-0000-0000-000000000001', 'October', '3', 'active'),
  ('cd000000-0000-0000-0000-000000000011', 'fd000000-0000-0000-0000-000000000002', 'Split X', '4', 'active'),
  ('cd000000-0000-0000-0000-000000000012', 'fd000000-0000-0000-0000-000000000002', 'Split Y', '5', 'active'),
  ('cd000000-0000-0000-0000-000000000021', 'fd000000-0000-0000-0000-000000000003', 'Room Z', '6', 'active'),
  ('cd000000-0000-0000-0000-000000000031', 'fd000000-0000-0000-0000-000000000004', 'Feb joiner', '7', 'active');
insert into capital_movements (customer_id, effective_from, amount) values
  ('cd000000-0000-0000-0000-00000000000a', '2025-09-01', 100000), ('cd000000-0000-0000-0000-00000000000b', '2025-09-01', 100000),
  ('cd000000-0000-0000-0000-00000000000c', '2025-10-01', 100000),
  ('cd000000-0000-0000-0000-000000000011', '2025-09-01', 100000), ('cd000000-0000-0000-0000-000000000012', '2025-09-01', 100000),
  ('cd000000-0000-0000-0000-000000000021', '2025-09-01', 100000);
insert into capital_movements (customer_id, received_at, amount) values
  ('cd000000-0000-0000-0000-00000000000a', '2025-09-15 11:30+05:30', 50000),  -- counts from 16 Sep
  ('cd000000-0000-0000-0000-00000000000b', '2025-09-15 12:30+05:30', 50000),  -- counts from 17 Sep
  ('cd000000-0000-0000-0000-00000000000c', '2025-10-15 09:00+05:30', 50000),  -- counts from 16 Oct (31-day month)
  ('cd000000-0000-0000-0000-000000000012', '2025-09-15 10:00+05:30', 100000), -- Y doubles from 16 Sep
  ('cd000000-0000-0000-0000-000000000021', '2025-09-15 10:00+05:30', 50000),  -- Z tops up from 16 Sep
  ('cd000000-0000-0000-0000-000000000031', '2025-02-10 09:00+05:30', 28000);  -- joins mid-February, counts from 11 Feb

-- The owner's example: ₹1,00,000 on the 1st = ₹6,000; ₹50,000 from the 16th of a 30-day month adds 6% × 50,000 × 15/30 = ₹1,500.
select is(day_cap('cd000000-0000-0000-0000-00000000000a', 6, '2025-09-15'), 6000.00, 'cap before the deposit starts: 6% of 1,00,000');
select is(day_cap('cd000000-0000-0000-0000-00000000000a', 6, '2025-09-16'), 7500.00, 'deposit before noon: 6,000 + 1,500 = 7,500 from the 16th');
select is(month_cap('cd000000-0000-0000-0000-00000000000a', '2025-09-01'), 7500.00, 'month bucket 7,500');
-- After noon: counts from the 17th, 14 of 30 days: 6% × 50,000 × 14/30 = 1,400.
select is(month_cap('cd000000-0000-0000-0000-00000000000b', '2025-09-01'), 7400.00, 'deposit after noon: 6,000 + 1,400 = 7,400');
-- 31-day month, from the 16th = 16 days: 6% × (1,00,000 + 50,000 × 16/31) = 7,548.387… → 7,548.39 (rounded once).
select is(month_cap('cd000000-0000-0000-0000-00000000000c', '2025-10-01'), 7548.39, '31-day month pro-rates by 16/31');
-- February 2025 (28 days), new customer from the 11th = 18 days: 6% × 28,000 × 18/28 = 1,080.
select is(month_cap('cd000000-0000-0000-0000-000000000031', '2025-02-01'), 1080.00, 'a mid-month joiner gets a pro-rated bucket');
select is(capital_on('cd000000-0000-0000-0000-00000000000a', '2025-09-15'), 100000.00, 'capital before the deposit starts');
select is(capital_on('cd000000-0000-0000-0000-00000000000a', '2025-09-16'), 150000.00, 'capital once it starts');

-- Daily split by that day's capital. X: 1,00,000 all month; Y: 1,00,000, then 2,00,000 from the 16th.
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fd000000-0000-0000-0000-000000000002', '2025-09-15', 1000),   -- 1:1   → 500 / 500
  ('fd000000-0000-0000-0000-000000000002', '2025-09-16', 3000),   -- 1:2   → 1,000 / 2,000
  ('fd000000-0000-0000-0000-000000000002', '2025-09-17', -3000);  -- loss 1:2 → -1,000 / -2,000
select results_eq(
  $$select trade_date, credited from customer_days where customer_id = 'cd000000-0000-0000-0000-000000000011' order by 1$$,
  $$values ('2025-09-15'::date, 500.00), ('2025-09-16', 1000.00), ('2025-09-17', -1000.00)$$, 'X: half, then a third, of each day');
select results_eq(
  $$select trade_date, credited, capital from customer_days where customer_id = 'cd000000-0000-0000-0000-000000000012' order by 1$$,
  $$values ('2025-09-15'::date, 500.00, 100000.00), ('2025-09-16', 2000.00, 200000.00), ('2025-09-17', -2000.00, 200000.00)$$,
  'Y: half, then two thirds, of each day, profit and loss');
select is((select cap from customer_days where customer_id = 'cd000000-0000-0000-0000-000000000012' and trade_date = '2025-09-16'),
  9000.00, 'Y''s bucket from the 16th: 6% × (1,00,000 + 1,00,000 × 15/30) = 9,000');

-- A deposit makes room in a full bucket. Z: bucket 6,000 is full on the 10th; from the 16th it is 7,500.
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fd000000-0000-0000-0000-000000000003', '2025-09-10', 10000),  -- 6,000 to Z (full), 4,000 overflow
  ('fd000000-0000-0000-0000-000000000003', '2025-09-12', 2000),   -- bucket full: all 2,000 overflow
  ('fd000000-0000-0000-0000-000000000003', '2025-09-16', 5000);   -- room 1,500: 1,500 to Z, 3,500 overflow
select results_eq(
  $$select trade_date, credited from customer_days where customer_id = 'cd000000-0000-0000-0000-000000000021' order by 1$$,
  $$values ('2025-09-10'::date, 6000.00), ('2025-09-12', 0.00), ('2025-09-16', 1500.00)$$, 'Z fills, waits, then fills the new room');
select results_eq(
  $$select trade_date, overflow, partner_income, exit_share from franchisee_days where franchisee_id = 'fd000000-0000-0000-0000-000000000003' order by 1$$,
  $$values ('2025-09-10'::date, 4000.00, 2800.00, 1200.00), ('2025-09-12', 2000.00, 1400.00, 600.00), ('2025-09-16', 3500.00, 2450.00, 1050.00)$$,
  'overflow split 70/30 between partner and Exit');

-- The February joiner only takes part from the 11th, and only up to the pro-rated bucket.
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fd000000-0000-0000-0000-000000000004', '2025-02-10', 900),   -- not started yet: all overflow
  ('fd000000-0000-0000-0000-000000000004', '2025-02-20', 5000);  -- 1,080 (the whole bucket) to the customer
select results_eq(
  $$select trade_date, credited, cap from customer_days where customer_id = 'cd000000-0000-0000-0000-000000000031' order by 1$$,
  $$values ('2025-02-20'::date, 1080.00, 1080.00)$$, 'no share before starting; then capped at the pro-rated bucket');
select results_eq(
  $$select trade_date, customers, overflow from franchisee_days where franchisee_id = 'fd000000-0000-0000-0000-000000000004' order by 1$$,
  $$values ('2025-02-10'::date, 0, 900.00), ('2025-02-20', 1, 3920.00)$$, 'partner day before/after the customer starts');

-- Preview, as the admin sees it in the Add money dialog.
insert into auth.users (id, email) values ('ad000000-0000-0000-0000-000000000001', 'admin@deposits.test');
insert into profiles (id, role) values ('ad000000-0000-0000-0000-000000000001', 'admin');
set local role authenticated;
set local request.jwt.claims = '{"sub":"ad000000-0000-0000-0000-000000000001"}';
select is(deposit_preview('cd000000-0000-0000-0000-00000000000a', 50000, '2025-09-15 11:30+05:30')::jsonb,
  '{"effective_from": "2025-09-16", "days": 15, "days_in_month": 30, "cap_added": 1500.00}'::jsonb, 'preview matches the bucket maths');
-- A person can't choose the start date: it comes from the received time.
insert into capital_movements (customer_id, received_at, effective_from, amount)
  values ('cd000000-0000-0000-0000-00000000000c', '2025-10-20 15:00+05:30', '2025-10-01', 1000);
select is((select effective_from from capital_movements where customer_id = 'cd000000-0000-0000-0000-00000000000c' and amount = 1000),
  '2025-10-22'::date, 'start date is worked out by the server, not taken from the browser');
select throws_ok($$insert into capital_movements (customer_id, effective_from, amount) values ('cd000000-0000-0000-0000-00000000000c', '2025-10-05', 1000)$$,
  'P0001', 'Enter when the money reached Exit', 'a deposit needs the time the money arrived');
select throws_ok($$update capital_movements set amount = 2 where customer_id = 'cd000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'capital entries can''t be edited');

select * from finish();
rollback;
