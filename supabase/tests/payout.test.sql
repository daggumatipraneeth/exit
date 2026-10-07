-- Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into franchisees (id, name, exit_commission_pct) values
  ('f0000000-0000-0000-0000-000000000001', 'Test Franchisee', 0),
  ('f0000000-0000-0000-0000-000000000002', 'Other Franchisee', 20);
insert into customers (id, franchisee_id, full_name, phone, status) values
  ('c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Test Client', '1', 'active'),
  ('c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Other Client', '2', 'active');
insert into customer_capital values
  ('c0000000-0000-0000-0000-000000000001', '2020-01-01', 100000),
  ('c0000000-0000-0000-0000-000000000002', '2020-01-01', 100000);

-- The plan's worked example: capital 1,00,000 → cap 6,000, Exit cut 0%.
insert into daily_entries (customer_id, trade_date, gross_pnl) values
  ('c0000000-0000-0000-0000-000000000001', '2020-03-02',  5000),
  ('c0000000-0000-0000-0000-000000000001', '2020-03-03',  3000),
  ('c0000000-0000-0000-0000-000000000001', '2020-03-04', -1000),
  ('c0000000-0000-0000-0000-000000000001', '2020-03-05',  2000);

select results_eq(
  $$select covered, customer_today, franchisee_income from daily_results
    where customer_id = 'c0000000-0000-0000-0000-000000000001' order by trade_date$$,
  $$values (5000.00::numeric(14,2), 5000.00::numeric(14,2), 0.00::numeric(14,2)),
           (6000, 1000, 2000), (5000, -1000, 0), (6000, 1000, 1000)$$,
  'waterfall: cap, overflow to franchisee, loss reduces customer only');

-- Editing a past day recomputes the rest of the month.
update daily_entries set gross_pnl = 7000 where customer_id = 'c0000000-0000-0000-0000-000000000001' and trade_date = '2020-03-02';
select results_eq(
  $$select covered, franchisee_income from daily_results
    where customer_id = 'c0000000-0000-0000-0000-000000000001' order by trade_date$$,
  $$values (6000.00::numeric(14,2), 1000.00::numeric(14,2)), (6000, 3000), (5000, 0), (6000, 1000)$$,
  'edit to day 1 flows through later days');

-- Deleting a day recomputes too.
delete from daily_entries where customer_id = 'c0000000-0000-0000-0000-000000000001' and trade_date = '2020-03-03';
select is((select sum(franchisee_income) from daily_results where customer_id = 'c0000000-0000-0000-0000-000000000001'),
          2000.00::numeric, 'delete recomputes month (7000, -1000, +2000 → 1000 + 1000)');

-- Cap resets each month.
insert into daily_entries (customer_id, trade_date, gross_pnl) values
  ('c0000000-0000-0000-0000-000000000001', '2020-04-01', 4000);
select is((select covered from daily_results where customer_id = 'c0000000-0000-0000-0000-000000000001' and trade_date = '2020-04-01'),
          4000.00::numeric(14,2), 'new month starts from zero');

-- Exit cut on profit only, after charges; rate snapshotted at entry time.
insert into daily_entries (customer_id, trade_date, gross_pnl, broker_charges, other_charges) values
  ('c0000000-0000-0000-0000-000000000002', '2020-03-02', 1000, 80, 20),
  ('c0000000-0000-0000-0000-000000000002', '2020-03-03', -500, 40, 10);
select results_eq(
  $$select pnl, exit_cut, net from daily_results where customer_id = 'c0000000-0000-0000-0000-000000000002' order by trade_date$$,
  $$values (900.00::numeric(14,2), 180.00::numeric(14,2), 720.00::numeric(14,2)), (-550, 0, -550)$$,
  'exit cut 20% of profit after charges, none on loss');
update franchisees set exit_commission_pct = 50 where id = 'f0000000-0000-0000-0000-000000000002';
update daily_entries set gross_pnl = 1000 where customer_id = 'c0000000-0000-0000-0000-000000000002' and trade_date = '2020-03-02';
select is((select exit_cut from daily_results where customer_id = 'c0000000-0000-0000-0000-000000000002' and trade_date = '2020-03-02'),
          180.00::numeric(14,2), 'rate change does not rewrite existing entries');

-- Capital change recomputes the cap for open months.
insert into customer_capital values ('c0000000-0000-0000-0000-000000000001', '2020-04-01', 50000);
select is((select cap from daily_results where customer_id = 'c0000000-0000-0000-0000-000000000001' and trade_date = '2020-04-01'),
          3000.00::numeric(14,2), 'capital change recomputes cap');

-- Closed months are frozen.
insert into closed_months (month) values ('2020-03-01');
select throws_ok($$insert into daily_entries (customer_id, trade_date, gross_pnl) values ('c0000000-0000-0000-0000-000000000001', '2020-03-10', 1)$$,
                 'P0001', 'Month Mar 2020 is closed', 'insert blocked in closed month');
select throws_ok($$update daily_entries set gross_pnl = 1 where trade_date = '2020-03-02'$$,
                 'P0001', 'Month Mar 2020 is closed', 'update blocked in closed month');
select throws_ok($$delete from daily_entries where trade_date = '2020-03-02'$$,
                 'P0001', 'Month Mar 2020 is closed', 'delete blocked in closed month');

-- Inactive customers can't have entries.
update customers set status = 'rejected' where id = 'c0000000-0000-0000-0000-000000000002';
select throws_ok($$insert into daily_entries (customer_id, trade_date, gross_pnl) values ('c0000000-0000-0000-0000-000000000002', '2020-05-04', 1)$$,
                 'P0001', 'Customer is not active', 'inactive customer blocked');

-- Row-level security: a franchisee sees only their own data.
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 't1@test'), ('a0000000-0000-0000-0000-000000000002', 't2@test');
insert into profiles (id, role, franchisee_id) values
  ('a0000000-0000-0000-0000-000000000001', 'franchisee', 'f0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'employee', null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';
select is((select count(*) from customers where franchisee_id <> 'f0000000-0000-0000-0000-000000000001'), 0::bigint, 'franchisee cannot see other customers');
select is((select count(*) from daily_results where franchisee_id <> 'f0000000-0000-0000-0000-000000000001'), 0::bigint, 'franchisee cannot see other results');
select is((select count(*) from franchisees), 1::bigint, 'franchisee sees only own franchisee row');
select isnt_empty($$select 1 from franchisee_daily$$, 'franchisee sees own dashboard');
select throws_ok($$insert into daily_entries (customer_id, trade_date, gross_pnl) values ('c0000000-0000-0000-0000-000000000001', '2020-05-04', 1)$$,
                 '42501', null, 'franchisee cannot enter results');
update customers set cap_pct = 50 where id = 'c0000000-0000-0000-0000-000000000001';
select is((select cap_pct from customers where id = 'c0000000-0000-0000-0000-000000000001'), 6.00::numeric(5,2),
          'franchisee cannot change terms of an active customer');
select lives_ok($$insert into customers (franchisee_id, full_name, phone, cap_pct) values ('f0000000-0000-0000-0000-000000000001', 'New Lead', '9', 99)$$,
                'franchisee can start a draft customer');

set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select throws_ok($$update customers set status = 'active' where full_name = 'New Lead'$$,
                 'P0001', 'Only an admin can approve a customer', 'employee cannot approve');

select * from finish();
rollback;
