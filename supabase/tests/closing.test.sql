-- Month close under the ledger: from the last day, by the job or an admin; pro-rated fixed payouts; full exit
-- with a deposit still pending; partial withdrawal; reopen. Figures worked by hand. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into franchisees (id, name) values ('fc000000-0000-0000-0000-000000000001', 'Close Partner');
insert into franchisee_terms values ('fc000000-0000-0000-0000-000000000001', 0);
insert into auth.users (id, email) values ('ac000000-0000-0000-0000-000000000001', 'admin@close.test'), ('ac000000-0000-0000-0000-000000000002', 'p@close.test');
insert into profiles (id, role, franchisee_id) values
  ('ac000000-0000-0000-0000-000000000001', 'admin', null), ('ac000000-0000-0000-0000-000000000002', 'franchisee', 'fc000000-0000-0000-0000-000000000001');
insert into customers (id, franchisee_id, full_name, phone, plan, status) values
  ('cc000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 'Q1 variable', '9700000071', 'variable', 'active'),
  ('cc000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000001', 'Q2 fixed', '9700000072', 'fixed', 'active'),
  ('cc000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000001', 'Q3 full exit', '9700000073', 'variable', 'active'),
  ('cc000000-0000-0000-0000-000000000004', 'fc000000-0000-0000-0000-000000000001', 'Q4 partial', '9700000074', 'variable', 'active');
insert into agreements (customer_id, template_version, signed_at)
select id, 1, now() from customers where franchisee_id = 'fc000000-0000-0000-0000-000000000001';
insert into capital_movements (customer_id, effective_from, amount)
select id, '2024-01-01', 100000 from customers where franchisee_id = 'fc000000-0000-0000-0000-000000000001';
insert into capital_movements (customer_id, received_at, amount) values
  ('cc000000-0000-0000-0000-000000000002', '2024-01-15 11:00+05:30', 50000),  -- from 16 Jan
  ('cc000000-0000-0000-0000-000000000003', '2024-01-31 14:00+05:30', 20000);  -- from 2 Feb: still pending at the Jan close
insert into daily_entries (franchisee_id, trade_date, amount) values
  ('fc000000-0000-0000-0000-000000000001', '2024-01-10', 3000),   -- 4 × 1,00,000: 750 each
  ('fc000000-0000-0000-0000-000000000001', '2024-01-20', -4500);  -- 1,00,000 / 1,50,000 / 1,00,000 / 1,00,000 of 4,50,000
insert into withdrawal_requests (customer_id, amount) values
  ('cc000000-0000-0000-0000-000000000003', 999999), ('cc000000-0000-0000-0000-000000000004', 30000);

select results_eq($$select customer_id, sum(credited) from customer_days where franchisee_id = 'fc000000-0000-0000-0000-000000000001' group by 1 order by 1$$,
  $$values ('cc000000-0000-0000-0000-000000000001'::uuid, -250.00), ('cc000000-0000-0000-0000-000000000002', -750.00),
           ('cc000000-0000-0000-0000-000000000003', -250.00), ('cc000000-0000-0000-0000-000000000004', -250.00)$$,
  'January: 750 - 1,000 = -250 each, Q2 750 - 1,500 = -750');

-- The job: nothing except on the last day.
select is(auto_close_month('2024-01-30'), 'not the last day', 'job does nothing before the last day');
set local role authenticated;
set local request.jwt.claims = '{"sub":"ac000000-0000-0000-0000-000000000002"}';
select throws_ok($$select close_month('2024-01-01')$$, 'P0001', 'Only an admin can close a month', 'a partner can''t close');
select throws_ok($$select auto_close_month('2024-01-31')$$, '42501', null, 'nobody can call the job from the app');
set local request.jwt.claims = '{"sub":"ac000000-0000-0000-0000-000000000001"}';
select case when today_ist() = (date_trunc('month', today_ist()) + interval '1 month')::date - 1
            then pass('today is the last day of the month')
            else throws_ok(format('select close_month(%L)', date_trunc('month', today_ist())::date), 'P0001', 'A month can be closed from its last day',
                           'this month can''t be closed before its last day') end;
reset role;
select is(auto_close_month('2024-01-31'), 'closed Jan 2024', 'job closes the month on its last day');
select is(auto_close_month('2024-01-31'), 'already closed', 'a month already closed is left alone');

select results_eq(
  $$select customer_id, result, profit_payout, withdrawal, full_exit, payout_total, carried_out from settlements where month = '2024-01-01' order by 1$$,
  $$values ('cc000000-0000-0000-0000-000000000001'::uuid, -250.00, 0.00, 0.00, false, 0.00, -250.00),
           ('cc000000-0000-0000-0000-000000000002', -750.00, 7548.39, 0.00, false, 7548.39, 0.00),
           ('cc000000-0000-0000-0000-000000000003', -250.00, 0.00, 119750.00, true, 119750.00, 0.00),
           ('cc000000-0000-0000-0000-000000000004', -250.00, 0.00, 30000.00, false, 30000.00, -250.00)$$,
  'Q1 carries 250; Q2 fixed gets 6% × (1,00,000 + 50,000 × 16/31) = 7,548.39; Q3 all 1,20,000 less 250; Q4 30,000');
select is((select sum(payout_total) - sum(profit_payout) - sum(withdrawal) from settlements where month = '2024-01-01'), 0.00,
  'every payout is profit plus withdrawal');
select is((select status from customers where id = 'cc000000-0000-0000-0000-000000000003'), 'closed'::customer_status, 'Q3 account closed');
select results_eq($$select d, capital_on('cc000000-0000-0000-0000-000000000003', d) from unnest('{2024-01-31,2024-02-01,2024-02-02,2024-12-31}'::date[]) d$$,
  $$values ('2024-01-31'::date, 100000.00), ('2024-02-01', 0.00), ('2024-02-02', 0.00), ('2024-12-31', 0.00)$$,
  'Q3: nothing left, and the pending deposit never starts');
select results_eq($$select d, capital_on('cc000000-0000-0000-0000-000000000004', d) from unnest('{2024-01-31,2024-02-01}'::date[]) d$$,
  $$values ('2024-01-31'::date, 100000.00), ('2024-02-01', 70000.00)$$, 'Q4: 70,000 from 1 Feb');
set constraints all immediate;
select pass('capital never below zero after the close');

-- Reopen puts everything back.
set local role authenticated;
set local request.jwt.claims = '{"sub":"ac000000-0000-0000-0000-000000000001"}';
select lives_ok($$select reopen_month('2024-01-01')$$, 'admin reopens January');
reset role;
select is((select status from customers where id = 'cc000000-0000-0000-0000-000000000003'), 'active'::customer_status, 'Q3 active again');
select results_eq($$select d, capital_on('cc000000-0000-0000-0000-000000000003', d) from unnest('{2024-02-01,2024-02-02}'::date[]) d$$,
  $$values ('2024-02-01'::date, 100000.00), ('2024-02-02', 120000.00)$$, 'Q3 capital and pending deposit restored');
select is(capital_on('cc000000-0000-0000-0000-000000000004', '2024-02-01'), 100000.00, 'Q4 capital restored');
select is((select count(*)::int from withdrawal_requests where status = 'open' and customer_id::text like 'cc%'), 2, 'withdrawal requests open again');

-- An earlier open month stops the job.
insert into daily_entries (franchisee_id, trade_date, amount) values ('fc000000-0000-0000-0000-000000000001', '2024-02-05', 100);
select is(auto_close_month('2024-02-29'), 'an earlier month is still open', 'job waits for earlier months');
select is((select count(*)::int from closed_months where month in ('2024-01-01', '2024-02-01')), 0, 'nothing closed');

select * from finish();
rollback;
