-- Customers log in with their mobile number, so two customers can't share one.
-- Compares the last 10 digits, so '+91 98480 10001' and '9848010001' are the same number.
-- A trigger rather than a unique index so existing duplicates don't block this migration; fix those by hand.
create function customer_mobile_unique() returns trigger
language plpgsql security definer set search_path = public as $$
declare v text := right(regexp_replace(new.phone, '\D', '', 'g'), 10);
begin
  if length(v) = 10 and exists (select 1 from customers where id <> new.id
                                  and right(regexp_replace(phone, '\D', '', 'g'), 10) = v) then
    raise exception 'Another customer already uses this mobile number';
  end if;
  return new;
end $$;

create trigger mobile_unique before insert or update of phone on customers
  for each row execute function customer_mobile_unique();
