-- Consultation requests from the website's "Request a call back" form, routed to the chosen office.

create table consultation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  interest text not null,
  office text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes text,
  handled_by uuid references auth.users on delete set null,
  handled_at timestamptz,
  source_ip text,
  created_at timestamptz not null default now()
);
create index on consultation_requests (office, status, created_at desc);

create trigger audit after insert or update or delete on consultation_requests for each row execute function audit();
create trigger keep before delete on consultation_requests
  for each row execute function keep_records('Consultation requests are kept. Close them instead of deleting.');

-- Offices the website offers (keep in step with src/config.js → offices).
create function office_names() returns text[]
language sql immutable as $$ select array['Guntur', 'Hyderabad'] $$;

-- Staff can be tied to one office; null = all offices (admins always see all).
alter table profiles add column office text check (office is null or office = any(office_names()));

create function my_office() returns text
language sql stable security definer set search_path = public as $$
  select case when my_role() = 'admin' then null else (select office from profiles where id = auth.uid()) end
$$;

alter table consultation_requests enable row level security;
create policy staff_read on consultation_requests for select to authenticated
  using (is_staff() and (my_office() is null or office = my_office()));
create policy staff_update on consultation_requests for update to authenticated
  using (is_staff() and (my_office() is null or office = my_office()))
  with check (is_staff() and (my_office() is null or office = my_office()));
-- Only status, notes and who handled it can change; the request itself stays as sent.
revoke all on consultation_requests from anon;
revoke insert, update, delete on consultation_requests from authenticated;
grant update (status, notes, handled_by, handled_at) on consultation_requests to authenticated;

-- Public (no login) submission with validation, a hidden bot trap and rate limits.
create function request_consultation(p_name text, p_phone text, p_email text, p_interest text,
                                     p_office text, p_message text, p_website text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  h json := coalesce(current_setting('request.headers', true), '{}')::json;
  v_ip text := nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if coalesce(p_website, '') <> '' then
    return; -- the hidden field only bots fill in: pretend success, store nothing
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 100 then raise exception 'Please enter your name'; end if;
  if v_phone !~ '^\+?[0-9]{10,13}$' then raise exception 'Enter a valid phone number'; end if;
  if coalesce(p_email, '') <> '' and (p_email !~ '^\S+@\S+\.\S+$' or length(p_email) > 200) then raise exception 'Enter a valid email'; end if;
  if not (p_office = any(office_names())) then raise exception 'Choose an office'; end if;
  if length(coalesce(p_interest, '')) not between 1 and 60 then raise exception 'Choose what you are interested in'; end if;
  if length(coalesce(p_message, '')) > 2000 then raise exception 'Please keep the message under 2,000 characters'; end if;
  if (select count(*) from consultation_requests where right(phone, 10) = right(v_phone, 10) and created_at > now() - interval '1 hour') >= 3
     or (v_ip is not null and (select count(*) from consultation_requests where source_ip = v_ip and created_at > now() - interval '10 minutes') >= 5) then
    raise exception 'We already have your request. Our team will call you soon.';
  end if;
  insert into consultation_requests (name, phone, email, interest, office, message, source_ip)
  values (trim(p_name), v_phone, nullif(trim(p_email), ''), p_interest, p_office, nullif(trim(p_message), ''), v_ip);
end $$;
revoke execute on function request_consultation(text, text, text, text, text, text, text) from public;
grant execute on function request_consultation(text, text, text, text, text, text, text) to anon, authenticated;
