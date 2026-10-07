-- Lets the Add customer form reject a duplicate PAN before creating the customer (compares fingerprints only).
create function pan_available(p_pan text) returns boolean
language sql stable security definer set search_path = public as $$
  select my_role() is not null and not exists (select 1 from customers where pan_hash = pii_hash(upper(trim(p_pan))))
$$;
revoke execute on function pan_available(text) from public, anon;
grant execute on function pan_available(text) to authenticated;
