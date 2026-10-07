-- Onboarding: signing links, public e-signing, approval rules, partner deactivation.

alter table profiles add column email text;
alter table customers add constraint customers_pan_key unique (pan);
-- The drawn signature is small (a PNG data URL), so it lives with the agreement it belongs to.
alter table agreements drop column signature_path, add column signature_png text, add column signer_name text;

-- A deactivated partner keeps their login but sees nothing.
create or replace function my_franchisee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select p.franchisee_id from profiles p join franchisees f on f.id = p.franchisee_id
  where p.id = auth.uid() and f.active
$$;

-- Approval needs a signed agreement.
create or replace function customer_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- server-side (service role / migrations / seed / signing RPC)
  end if;
  if not is_staff() then
    if tg_op = 'INSERT' then
      new.cap_pct := 6; -- default terms; admin adjusts on approval
    elsif new.cap_pct <> old.cap_pct or new.franchisee_id <> old.franchisee_id then
      raise exception 'Only Exit staff can change customer terms';
    end if;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if not is_admin() then
      raise exception 'Only an admin can approve a customer';
    end if;
    if not exists (select 1 from agreements where customer_id = new.id and signed_at is not null) then
      raise exception 'The customer has not signed the agreement yet';
    end if;
  end if;
  return new;
end $$;

-- Links are created through create_signing_link() only.
drop policy create_link on agreements;

create function html_escape(s text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(s, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create function render_agreement(p_agreement uuid) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(t.body,
    '{{full_name}}', html_escape(c.full_name)),
    '{{pan}}', html_escape(c.pan)),
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

-- Checks onboarding is complete, replaces any unsigned link, returns the new token.
create function create_signing_link(p_customer uuid) returns uuid
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
  if c.pan is null then missing := missing || 'PAN number'::text; end if;
  if c.aadhaar_last4 is null then missing := missing || 'Aadhaar last 4 digits'::text; end if;
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

-- Public (no login): what the customer sees before signing. The text is hidden once signed.
create function get_agreement(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'customer', c.full_name,
    'signed_at', a.signed_at,
    'expired', a.signed_at is null and a.token_expires_at < now(),
    'html', case when a.signed_at is null and a.token_expires_at >= now() then render_agreement(a.id) end)
  from agreements a join customers c on c.id = a.customer_id
  where a.sign_token = p_token
$$;

-- Public (no login): freeze exactly what was signed, with the evidence trail.
create function sign_agreement(p_token uuid, p_name text, p_signature text) returns void
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
    rendered_html = v_html,
    html_sha256 = encode(extensions.digest(v_html, 'sha256'), 'hex'),
    signature_png = p_signature,
    signer_name = trim(p_name),
    signed_at = now(),
    signer_ip = nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
    signer_user_agent = left(h->>'user-agent', 500)
  where id = a.id;
  update customers set status = 'pending_approval' where id = a.customer_id and status = 'awaiting_signature';
end $$;

revoke execute on function render_agreement(uuid), create_signing_link(uuid), get_agreement(uuid), sign_agreement(uuid, text, text) from public;
grant execute on function create_signing_link(uuid) to authenticated;
grant execute on function get_agreement(uuid), sign_agreement(uuid, text, text) to anon, authenticated;
