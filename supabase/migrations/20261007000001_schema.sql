-- Core tables for the Exit partner portal.

create type user_role as enum ('admin', 'employee', 'franchisee');
create type customer_status as enum ('draft', 'awaiting_signature', 'pending_approval', 'active', 'rejected');
create type doc_kind as enum ('pan', 'aadhaar_front', 'aadhaar_back', 'photo', 'signature');

create table franchisees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  exit_commission_pct numeric(5,2) not null check (exit_commission_pct between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role user_role not null,
  franchisee_id uuid references franchisees,
  check ((role = 'franchisee') = (franchisee_id is not null))
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  franchisee_id uuid not null references franchisees,
  full_name text not null,
  phone text not null,
  email text,
  dob date,
  address text,
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  aadhaar_last4 text check (aadhaar_last4 ~ '^[0-9]{4}$'), -- never store the full Aadhaar number
  cap_pct numeric(5,2) not null default 6 check (cap_pct between 0 and 100),
  status customer_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);
create index on customers (franchisee_id);

-- Capital history; the monthly cap uses the amount in force on the 1st.
create table customer_capital (
  customer_id uuid not null references customers on delete cascade,
  effective_from date not null,
  amount numeric(14,2) not null check (amount > 0),
  primary key (customer_id, effective_from)
);

create table customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  kind doc_kind not null,
  path text not null unique, -- storage path in the private `kyc` bucket
  uploaded_at timestamptz not null default now(),
  unique (customer_id, kind)
);

create table agreement_templates (
  version serial primary key,
  title text not null,
  body text not null, -- HTML with {{full_name}}, {{pan}}, {{capital}}, {{cap_pct}}, {{franchisee}}, {{date}}
  created_at timestamptz not null default now()
);

create table agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  template_version int not null references agreement_templates,
  sign_token uuid not null unique default gen_random_uuid(),
  token_expires_at timestamptz not null default now() + interval '7 days',
  rendered_html text,  -- frozen copy of exactly what was signed
  html_sha256 text,
  signature_path text,
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  created_at timestamptz not null default now()
);
create index on agreements (customer_id);

create table daily_entries (
  customer_id uuid not null references customers,
  trade_date date not null,
  trades_count int not null default 0 check (trades_count >= 0),
  gross_pnl numeric(14,2) not null,
  broker_charges numeric(14,2) not null default 0 check (broker_charges >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  exit_commission_pct numeric(5,2) not null, -- snapshot of the franchisee rate, filled by trigger
  entered_by uuid default auth.uid() references auth.users,
  entered_at timestamptz not null default now(),
  primary key (customer_id, trade_date)
);

-- Written only by recompute_month(); never edit by hand.
create table daily_results (
  customer_id uuid not null,
  trade_date date not null,
  franchisee_id uuid not null references franchisees,
  trades_count int not null,
  pnl numeric(14,2) not null,               -- gross - charges
  exit_cut numeric(14,2) not null,          -- Exit's % of profit
  net numeric(14,2) not null,               -- pnl - exit_cut
  cap numeric(14,2) not null,               -- monthly max payout for the customer
  covered numeric(14,2) not null,           -- customer's month-to-date share after today
  customer_today numeric(14,2) not null,    -- change in covered today
  franchisee_income numeric(14,2) not null, -- overflow above the cap today
  primary key (customer_id, trade_date),
  foreign key (customer_id, trade_date) references daily_entries on delete cascade on update cascade
);
create index on daily_results (franchisee_id, trade_date);

create table closed_months (
  month date primary key check (month = date_trunc('month', month)::date),
  closed_by uuid default auth.uid() references auth.users,
  closed_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  table_name text not null,
  op text not null,
  old jsonb,
  new jsonb
);

create function audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (table_name, op, old, new)
  values (tg_table_name, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'franchisees', 'customers', 'customer_capital', 'customer_documents',
                           'agreement_templates', 'agreements', 'daily_entries', 'closed_months'] loop
    execute format('create trigger audit after insert or update or delete on %I for each row execute function audit()', t);
  end loop;
end $$;
