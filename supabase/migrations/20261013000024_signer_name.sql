-- The name typed when signing must be the customer's own name. Case, spacing and punctuation don't count,
-- so 'ravi k teja' signs for 'Ravi K. Teja'; anything else is refused before the signature is stored.
create function same_name(a text, b text) returns boolean
language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(a, '')), '[^[:alnum:]]+', ' ', 'g'))
       = trim(regexp_replace(lower(coalesce(b, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;

create or replace function sign_agreement(p_token uuid, p_name text, p_signature text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a agreements;
  h json := coalesce(current_setting('request.headers', true), '{}')::json;
  v_html text;
  v_customer text;
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
  select full_name into v_customer from customers where id = a.customer_id;
  if not same_name(p_name, v_customer) then
    raise exception 'Type your name as on your PAN card: %', v_customer;
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
