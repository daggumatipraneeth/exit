-- Local dev data only. Every login uses the password: password123
--   admin@exit.local (admin) · staff@exit.local (employee)
--   ravi@exit.local (franchisee, Guntur) · priya@exit.local (franchisee, Hyderabad)

create function pg_temp.add_user(p_id uuid, p_email text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email),
          'email', now(), now(), now());
$$;

select pg_temp.add_user('00000000-0000-0000-0000-00000000000a', 'admin@exit.local');
select pg_temp.add_user('00000000-0000-0000-0000-00000000000e', 'staff@exit.local');
select pg_temp.add_user('00000000-0000-0000-0000-0000000000f1', 'ravi@exit.local');
select pg_temp.add_user('00000000-0000-0000-0000-0000000000f2', 'priya@exit.local');

insert into franchisees (id, name, phone, email, profit_share_pct) values
  ('10000000-0000-0000-0000-000000000001', 'Ravi Kumar Associates', '+91 90000 11111', 'ravi@exit.local', 70),
  ('10000000-0000-0000-0000-000000000002', 'Priya Wealth Partners', '+91 90000 22222', 'priya@exit.local', 70);
insert into franchisee_terms (franchisee_id, hidden_charge_pct) values
  ('10000000-0000-0000-0000-000000000001', 20),
  ('10000000-0000-0000-0000-000000000002', 25);

insert into profiles (id, full_name, email, role, franchisee_id) values
  ('00000000-0000-0000-0000-00000000000a', 'Exit Admin', 'admin@exit.local', 'admin', null),
  ('00000000-0000-0000-0000-00000000000e', 'Exit Staff', 'staff@exit.local', 'employee', null),
  ('00000000-0000-0000-0000-0000000000f1', 'Ravi Kumar', 'ravi@exit.local', 'franchisee', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000f2', 'Priya Reddy', 'priya@exit.local', 'franchisee', '10000000-0000-0000-0000-000000000002');

insert into agreement_templates (title, body) values ('Client Trading Agreement v1', $html$
<h2>Client Trading Agreement</h2>
<p><strong>DRAFT, needs legal review before use.</strong></p>
<p>This agreement is made on {{date}} between <strong>Exit Stock Broker Private Limited</strong> ("Exit"),
its partner <strong>{{franchisee}}</strong> ("Partner"), and <strong>{{full_name}}</strong> (PAN {{pan}}) ("Client").</p>
<ol>
  <li>The Client places capital of <strong>{{capital}}</strong> with Exit for trading.</li>
  <li>The Client's payout in any calendar month is capped at <strong>{{cap_pct}}%</strong> of capital.
      Returns above the cap are shared between the Partner and Exit.</li>
  <li>Brokerage, statutory and other charges are deducted before any payout is calculated.</li>
  <li>Trading involves risk of loss. Losses reduce the Client's payout for that month. Returns are not guaranteed.</li>
  <li>The Client confirms the KYC documents submitted are true and their own.</li>
</ol>
$html$);

-- 10 customers, 5 per franchisee, active, with capital from the start of last month.
insert into customers (id, franchisee_id, full_name, phone, pan_enc, pan_hash, aadhaar_enc, status)
select ('20000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       case when i <= 5 then '10000000-0000-0000-0000-000000000001'::uuid else '10000000-0000-0000-0000-000000000002'::uuid end,
       (array['Anil Varma','Bhavani Rao','Chandra Sekhar','Divya Teja','Eshwar Naidu',
              'Farhan Ali','Gayatri Devi','Harish Goud','Indira Reddy','Jagan Mohan'])[i],
       '+91 98480 ' || lpad((10000 + i)::text, 5, '0'),
       pii_encrypt('ABCDE' || lpad((1000 + i)::text, 4, '0') || 'F'),
       pii_hash('ABCDE' || lpad((1000 + i)::text, 4, '0') || 'F'),
       pii_encrypt(lpad((1000 + i * 37)::text, 4, '0')),
       'active'
from generate_series(1, 10) i;

insert into customer_capital (customer_id, effective_from, amount)
select id, (date_trunc('month', current_date) - interval '1 month')::date,
       (array[100000, 250000, 500000, 150000, 300000, 200000, 400000, 120000, 750000, 180000])[row_number() over (order by id)]
from customers;

-- Seeded customers count as signed, so later edits by admin pass the approval rule.
insert into agreements (customer_id, template_version, rendered_html_enc, signer_name, signed_at)
select id, 1, pii_encrypt('<p>Seeded test agreement</p>'), full_name, now() from customers;

-- One customer mid-onboarding for Ravi.
insert into customers (franchisee_id, full_name, phone, email, status)
values ('10000000-0000-0000-0000-000000000001', 'Kavya Lakshmi', '+91 98480 20001', 'kavya@example.com', 'draft');

-- One figure per partner per weekday, from the start of last month to today. Deterministic pseudo-random:
-- averages about 0.5% of the partner's total capital a day, so buckets fill around mid-month.
select setseed(0.42);
insert into daily_entries (franchisee_id, trade_date, amount)
select f.id, d::date, round((t.capital * (random() * 0.0165 - 0.0033))::numeric, 2)
from franchisees f
cross join lateral (select sum(k.amount) capital from customer_capital k join customers c on c.id = k.customer_id where c.franchisee_id = f.id) t
cross join generate_series(date_trunc('month', current_date) - interval '1 month', current_date, interval '1 day') d
where extract(isodow from d) < 6
order by d, f.id;

-- Website call-back requests
insert into consultation_requests (name, phone, email, interest, office, message, status, created_at) values
  ('Lakshmi Prasad', '+919848012345', 'lakshmi@example.com', 'Stock Advisory', 'Guntur', 'Looking to open an account for my father too.', 'new', now() - interval '2 hours'),
  ('Arjun Reddy', '+919000054321', null, 'Portfolio Management', 'Hyderabad', 'I run an insurance office in Kukatpally.', 'new', now() - interval '1 day'),
  ('Meena K', '+919391122334', null, 'Mutual Funds / SIP', 'Guntur', null, 'contacted', now() - interval '3 days');
