-- Encrypt PAN and Aadhaar (and the signed agreement text, which contains the PAN).
--
-- The key is generated here, inside the database, and kept in Supabase Vault (itself encrypted with a key
-- Supabase holds outside the database). It is never in Git, and backups of the data don't contain it.
-- Save a copy of the key somewhere safe (PORTAL.md → Encryption key): without it, encrypted values can't be
-- read after restoring into a new project.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'pii_key', 'Encrypts PAN, Aadhaar, agreements and KYC files');

create function pii_key() returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'pii_key'
$$;
revoke execute on function pii_key() from public, anon, authenticated;
grant execute on function pii_key() to service_role; -- the KYC file function needs it

create function pii_encrypt(p text) returns bytea
language sql volatile security definer set search_path = public as $$
  select case when p is null then null else extensions.pgp_sym_encrypt(p, pii_key(), 'cipher-algo=aes256') end
$$;
create function pii_decrypt(p bytea) returns text
language sql stable security definer set search_path = public as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, pii_key()) end
$$;
-- Keyed fingerprint so duplicate PANs are still detected without storing the PAN.
create function pii_hash(p text) returns text
language sql stable security definer set search_path = public as $$
  select case when p is null then null else encode(extensions.hmac(upper(p), pii_key(), 'sha256'), 'hex') end
$$;
revoke execute on function pii_encrypt(text), pii_decrypt(bytea), pii_hash(text) from public, anon, authenticated;

-- Convert existing rows. Keep-forever and audit triggers are paused for this one-off conversion only.
set session_replication_role = replica;

alter table customers add column pan_enc bytea, add column pan_hash text unique, add column aadhaar_enc bytea;
update customers set pan_enc = pii_encrypt(pan), pan_hash = pii_hash(pan), aadhaar_enc = pii_encrypt(aadhaar_last4)
 where pan is not null or aadhaar_last4 is not null;
alter table customers drop column pan, drop column aadhaar_last4;

alter table agreements add column rendered_html_enc bytea;
update agreements set rendered_html_enc = pii_encrypt(rendered_html) where rendered_html is not null;
alter table agreements drop column rendered_html;

-- Scrub plaintext copies from the activity log.
update audit_log set old = old - 'pan' - 'aadhaar_last4' - 'rendered_html', new = new - 'pan' - 'aadhaar_last4' - 'rendered_html'
 where table_name in ('customers', 'agreements');

set session_replication_role = origin;

-- Reading: staff, or the customer's own partner.
create function customer_pii(p_customer uuid) returns table (pan text, aadhaar_last4 text)
language sql stable security definer set search_path = public as $$
  select pii_decrypt(pan_enc), pii_decrypt(aadhaar_enc) from customers where id = p_customer and can_see_customer(p_customer)
$$;

-- Writing: same rule as editing the customer (staff always; the partner while onboarding).
create function set_customer_pii(p_customer uuid, p_pan text, p_aadhaar_last4 text) returns void
language plpgsql security definer set search_path = public as $$
declare v_pan text := nullif(upper(trim(p_pan)), ''); v_aadhaar text := nullif(trim(p_aadhaar_last4), '');
begin
  if not (is_staff() or exists (select 1 from customers where id = p_customer and franchisee_id = my_franchisee_id()
                                   and status in ('draft', 'awaiting_signature'))) then
    raise exception 'You cannot change this customer';
  end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'PAN is 5 letters, 4 digits, 1 letter'; end if;
  if v_aadhaar is not null and v_aadhaar !~ '^[0-9]{4}$' then raise exception 'Aadhaar must be the last 4 digits'; end if;
  if v_pan is not null and exists (select 1 from customers where pan_hash = pii_hash(v_pan) and id <> p_customer) then
    raise exception 'Another customer already has this PAN.';
  end if;
  update customers set pan_enc = pii_encrypt(v_pan), pan_hash = pii_hash(v_pan), aadhaar_enc = pii_encrypt(v_aadhaar)
   where id = p_customer;
end $$;

revoke execute on function customer_pii(uuid), set_customer_pii(uuid, text, text) from public, anon;
grant execute on function customer_pii(uuid), set_customer_pii(uuid, text, text) to authenticated;

-- Encrypted columns are never sent to the browser.
revoke select (pan_enc, pan_hash, aadhaar_enc) on customers from anon, authenticated;
revoke update (pan_enc, pan_hash, aadhaar_enc) on customers from anon, authenticated;
revoke insert (pan_enc, pan_hash, aadhaar_enc) on customers from anon, authenticated;
revoke select (rendered_html_enc) on agreements from anon, authenticated;

-- Signed agreement for the customer page: staff, or the customer's own partner.
create function signed_agreement(p_customer uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('html', pii_decrypt(a.rendered_html_enc), 'signer_name', a.signer_name, 'signed_at', a.signed_at,
                           'signer_ip', a.signer_ip, 'html_sha256', a.html_sha256, 'signature_png', a.signature_png)
  from agreements a
  where a.customer_id = p_customer and a.signed_at is not null and can_see_customer(p_customer)
  order by a.signed_at desc limit 1
$$;
revoke execute on function signed_agreement(uuid) from public, anon;
grant execute on function signed_agreement(uuid) to authenticated;

-- The agreement and onboarding checks read the decrypted values.
create or replace function render_agreement(p_agreement uuid) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(t.body,
    '{{full_name}}', html_escape(c.full_name)),
    '{{pan}}', html_escape(pii_decrypt(c.pan_enc))),
    '{{franchisee}}', html_escape(f.name)),
    '{{cap_pct}}', rtrim(to_char(c.cap_pct, 'FM990.##'), '.')),
    '{{capital}}', '₹' || to_char((select amount from customer_capital k where k.customer_id = c.id order by effective_from desc limit 1), 'FM99,99,99,99,999')),
    '{{date}}', to_char(now() at time zone 'Asia/Kolkata', 'FMDD FMMonth YYYY'))
  from agreements a
  join agreement_templates t on t.version = a.template_version
  join customers c on c.id = a.customer_id
  join franchisees f on f.id = c.franchisee_id
  where a.id = p_agreement
$$;

create or replace function create_signing_link(p_customer uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c customers;
  missing text[] := '{}';
  v_token uuid;
begin
  if not can_edit_kyc(p_customer) then
    raise exception 'You cannot change this customer';
  end if;
  select * into c from customers where id = p_customer;
  if c.pan_enc is null then missing := missing || 'PAN number'::text; end if;
  if c.aadhaar_enc is null then missing := missing || 'Aadhaar last 4 digits'::text; end if;
  if not exists (select 1 from customer_capital where customer_id = p_customer) then missing := missing || 'capital'::text; end if;
  if not exists (select 1 from customer_documents where customer_id = p_customer and kind = 'pan') then missing := missing || 'PAN card photo'::text; end if;
  if not exists (select 1 from customer_documents where customer_id = p_customer and kind = 'aadhaar_front') then missing := missing || 'Aadhaar front photo'::text; end if;
  if not exists (select 1 from customer_documents where customer_id = p_customer and kind = 'aadhaar_back') then missing := missing || 'Aadhaar back photo'::text; end if;
  if cardinality(missing) > 0 then
    raise exception 'Add the % first', array_to_string(missing, ', ');
  end if;
  if not exists (select 1 from agreement_templates) then
    raise exception 'Exit has not set up an agreement yet';
  end if;
  delete from agreements where customer_id = p_customer and signed_at is null;
  insert into agreements (customer_id, template_version)
  values (p_customer, (select max(version) from agreement_templates))
  returning sign_token into v_token;
  update customers set status = 'awaiting_signature' where id = p_customer;
  return v_token;
end $$;

create or replace function sign_agreement(p_token uuid, p_name text, p_signature text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a agreements;
  h json := coalesce(current_setting('request.headers', true), '{}')::json;
  v_html text;
begin
  select * into a from agreements where sign_token = p_token for update;
  if not found then
    raise exception 'This signing link is not valid';
  end if;
  if a.signed_at is not null then
    raise exception 'This agreement is already signed';
  end if;
  if a.token_expires_at < now() then
    raise exception 'This signing link has expired. Ask your partner for a new one.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Type your full name to sign';
  end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 400000 then
    raise exception 'Draw your signature to sign';
  end if;
  v_html := render_agreement(a.id);
  update agreements set
    rendered_html_enc = pii_encrypt(v_html),
    html_sha256 = encode(extensions.digest(v_html, 'sha256'), 'hex'),
    signature_png = p_signature,
    signer_name = trim(p_name),
    signed_at = now(),
    signer_ip = nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
    signer_user_agent = left(h->>'user-agent', 500)
  where id = a.id;
  update customers set status = 'pending_approval' where id = a.customer_id and status = 'awaiting_signature';
end $$;

-- KYC files: from now on only the kyc-file server function (service role) reads and writes them,
-- encrypting on the way in and decrypting for permitted viewers on the way out.
drop policy kyc_read on storage.objects;
drop policy kyc_insert on storage.objects;
update storage.buckets set allowed_mime_types = array['application/octet-stream'] where id = 'kyc';
alter table customer_documents add column mime text;
