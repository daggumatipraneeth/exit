-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Partner P: hidden charge 20%, partner keeps 70% of the overflow.
insert into franchisees (id, name, profit_share_pct) values
  ('f0000000-0000-0000-0000-000000000001', 'Test Partner', 70),
  ('f0000000-0000-0000-0000-000000000002', 'Other Partner', 60),
  ('f0000000-0000-0000-0000-000000000003', 'Uneven Partner', 70),
  ('f0000000-0000-0000-0000-000000000004', 'Paise Partner', 70);
insert into franchisee_terms values
  ('f0000000-0000-0000-0000-000000000001', 20), ('f0000000-0000-0000-0000-000000000002', 10),
  ('f0000000-0000-0000-0000-000000000003', 0), ('f0000000-0000-0000-0000-000000000004', 0);
-- A: ₹1L (bucket ₹6,000), B: ₹2L (bucket ₹12,000)
insert into customers (id, franchisee_id, full_name, phone, status, cap_pct) values
  ('c0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000001', 'A', '1', 'active', 6),
  ('c0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000001', 'B', '2', 'active', 6),
  ('c0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000002', 'C', '3', 'active', 6),
  ('c0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000003', 'D', '4', 'active', 6),
  ('c0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000003', 'E', '5', 'active', 3),
  ('c0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000004', 'X', '6', 'active', 6),
  ('c0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000004', 'Y', '7', 'active', 6),
  ('c0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000004', 'Z', '8', 'active', 6);
insert into customer_capital values
  ('c0000000-0000-0000-0000-00000000000a', '2020-01-01', 100000), ('c0000000-0000-0000-0000-00000000000b', '2020-01-01', 200000),
  ('c0000000-0000-0000-0000-00000000000c', '2020-01-01', 100000),
  ('c0000000-0000-0000-0000-00000000000d', '2020-01-01', 100000), ('c0000000-0000-0000-0000-00000000000e', '2020-01-01', 100000),
  ('c0000000-0000-0000-0000-000000000011', '2020-01-01', 100000), ('c0000000-0000-0000-0000-000000000012', '2020-01-01', 100000),
  ('c0000000-0000-0000-0000-000000000013', '2020-01-01', 100000);

-- The worked example.
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('f0000000-0000-0000-0000-000000000001', '2020-03-02',  10000),
  ('f0000000-0000-0000-0000-000000000001', '2020-03-03',  30000),
  ('f0000000-0000-0000-0000-000000000001', '2020-03-04',  -3000),
  ('f0000000-0000-0000-0000-000000000001', '2020-03-05',   5000);

select results_eq(
  $$select net, to_customers, overflow, partner_income, exit_share from franchisee_days
    where franchisee_id = 'f0000000-0000-0000-0000-000000000001' order by trade_date$$,
  $$values (8000.00::numeric(14,2), 8000.00::numeric(14,2), 0.00::numeric(14,2), 0.00::numeric(14,2), 0.00::numeric(14,2)),
           (24000, 10000, 14000, 9800, 4200),
           (-3000, -3000, 0, 0, 0),
           (4000, 3000, 1000, 700, 300)$$,
  'partner days: hidden charge on profit only, buckets first, then 70/30');
select results_eq(
  $$select credited, covered from customer_days where customer_id = 'c0000000-0000-0000-0000-00000000000a' order by trade_date$$,
  $$values (2666.67::numeric(14,2), 2666.67::numeric(14,2)), (3333.33, 6000), (-1000, 5000), (1000, 6000)$$,
  'customer A gets one third by capital, fills, loses, refills');
select results_eq(
  $$select credited, covered from customer_days where customer_id = 'c0000000-0000-0000-0000-00000000000b' order by trade_date$$,
  $$values (5333.33::numeric(14,2), 5333.33::numeric(14,2)), (6666.67, 12000), (-2000, 10000), (2000, 12000)$$,
  'customer B gets two thirds');
select is((select sum(credited) from customer_days where franchisee_id = 'f0000000-0000-0000-0000-000000000001' and trade_date = '2020-03-02'),
          8000.00::numeric, 'paise add up exactly on a split day');

-- Uneven buckets: D bucket ₹6,000, E bucket ₹3,000, equal capital. ₹8,000: E fills at ₹3,000, D gets the rest.
insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000003', '2020-03-02', 8000);
select results_eq(
  $$select credited from customer_days where franchisee_id = 'f0000000-0000-0000-0000-000000000003' order by customer_id$$,
  $$values (5000.00::numeric(14,2)), (3000.00)$$,
  'a full bucket spills over to the customer with room');
select is((select overflow from franchisee_days where franchisee_id = 'f0000000-0000-0000-0000-000000000003'), 0.00::numeric(14,2),
          'no partner income while any bucket has room');

-- Paise: ₹100 over three equal customers = 33.34 + 33.33 + 33.33.
insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000004', '2020-03-02', 100);
select results_eq(
  $$select sum(credited), max(credited), min(credited) from customer_days where franchisee_id = 'f0000000-0000-0000-0000-000000000004'$$,
  $$values (100.00::numeric, 33.34::numeric(14,2), 33.33::numeric(14,2))$$,
  'leftover paise go to one customer; total is exact');
insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000004', '2020-03-03', -100);
select is((select sum(credited) from customer_days where franchisee_id = 'f0000000-0000-0000-0000-000000000004' and trade_date = '2020-03-03'),
          -100.00::numeric, 'loss paise add up exactly');

-- Editing a past day recomputes the rest of the month.
update daily_entries set amount = 50000 where franchisee_id = 'f0000000-0000-0000-0000-000000000001' and trade_date = '2020-03-02';
select results_eq(
  $$select to_customers, overflow from franchisee_days where franchisee_id = 'f0000000-0000-0000-0000-000000000001' order by trade_date$$,
  $$values (18000.00::numeric(14,2), 22000.00::numeric(14,2)), (0, 24000), (-3000, 0), (3000, 1000)$$,
  'edit to day 1 flows through later days');

-- Deleting a day recomputes too.
delete from daily_entries where franchisee_id = 'f0000000-0000-0000-0000-000000000001' and trade_date = '2020-03-03';
select is((select sum(overflow) from franchisee_days where franchisee_id = 'f0000000-0000-0000-0000-000000000001'),
          23000.00::numeric, 'delete recomputes month');

-- Buckets reset each month.
insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000001', '2020-04-01', 5000);
select is((select covered from customer_days where customer_id = 'c0000000-0000-0000-0000-00000000000a' and trade_date = '2020-04-01'),
          1333.33::numeric(14,2), 'new month starts from an empty bucket');

-- Terms are snapshotted when a day is first entered.
insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000002', '2020-03-02', 1000);
update franchisee_terms set hidden_charge_pct = 50 where franchisee_id = 'f0000000-0000-0000-0000-000000000002';
update daily_entries set amount = 1000 where franchisee_id = 'f0000000-0000-0000-0000-000000000002';
select is((select net from franchisee_days where franchisee_id = 'f0000000-0000-0000-0000-000000000002'), 900.00::numeric(14,2),
          'changing the hidden charge does not rewrite existing days');

-- Capital change recomputes the bucket size for open months.
insert into customer_capital values ('c0000000-0000-0000-0000-00000000000a', '2020-04-01', 400000);
select is((select cap from customer_days where customer_id = 'c0000000-0000-0000-0000-00000000000a' and trade_date = '2020-04-01'),
          24000.00::numeric(14,2), 'capital change recomputes bucket');

-- A customer who is not active is left out.
update customers set status = 'rejected' where id = 'c0000000-0000-0000-0000-00000000000b';
select is((select count(*) from customer_days where customer_id = 'c0000000-0000-0000-0000-00000000000b'), 0::bigint,
          'inactive customer gets no share');

-- Closed months are frozen.
insert into closed_months (month) values ('2020-03-01');
select throws_ok($$insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000001', '2020-03-10', 1)$$,
                 'P0001', 'Month Mar 2020 is closed', 'insert blocked in closed month');
select throws_ok($$update daily_entries set amount = 1 where trade_date = '2020-03-02'$$,
                 'P0001', 'Month Mar 2020 is closed', 'update blocked in closed month');
select throws_ok($$delete from daily_entries where trade_date = '2020-03-02'$$,
                 'P0001', 'Month Mar 2020 is closed', 'delete blocked in closed month');

-- Row-level security: a partner sees only their own results and never the entered amount or hidden charge.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 't1@test'), ('a0000000-0000-0000-0000-000000000002', 't2@test');
insert into profiles (id, role, franchisee_id) values
  ('a0000000-0000-0000-0000-000000000001', 'franchisee', 'f0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'employee', null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
select is((select count(*) from daily_entries), 0::bigint, 'partner cannot read entered amounts');
select is((select count(*) from franchisee_terms), 0::bigint, 'partner cannot read the hidden charge');
select is((select count(*) from franchisee_days where franchisee_id <> 'f0000000-0000-0000-0000-000000000001'), 0::bigint, 'partner sees only own days');
select isnt_empty($$select 1 from franchisee_days$$, 'partner sees own days');
select throws_ok($$insert into daily_entries (franchisee_id, trade_date, amount) values ('f0000000-0000-0000-0000-000000000001', '2020-05-04', 1)$$,
                 '42501', null, 'partner cannot enter results');
update customers set cap_pct = 50 where id = 'c0000000-0000-0000-0000-00000000000a';
select is((select cap_pct from customers where id = 'c0000000-0000-0000-0000-00000000000a'), 6.00::numeric(5,2),
          'partner cannot change terms of an active customer');
select lives_ok($$insert into customers (franchisee_id, full_name, phone, cap_pct) values ('f0000000-0000-0000-0000-000000000001', 'New Lead', '9', 99)$$,
                'partner can start a draft customer');

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select throws_ok($$update customers set status = 'active' where full_name = 'New Lead'$$,
                 'P0001', 'Only an admin can approve a customer', 'employee cannot approve');

select * from finish();
rollback;
