-- Logins Exit hands out carry a temporary password: the admin-users function marks the account with
-- app_metadata.must_change_password, and the portal asks for a new password before showing anything else.
-- After changing it the person calls password_changed(): it clears the mark and puts the change in the
-- activity log (the database can't see the password change itself; Supabase Auth does that).
create function password_changed() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in first'; end if;
  update auth.users set raw_app_meta_data = raw_app_meta_data - 'must_change_password' where id = auth.uid();
  insert into audit_log (actor, table_name, op, new)
  select auth.uid(), 'profiles', 'PASSWORD', jsonb_build_object('id', id, 'full_name', full_name) from profiles where id = auth.uid();
end $$;
revoke execute on function password_changed() from public, anon;
grant execute on function password_changed() to authenticated;
