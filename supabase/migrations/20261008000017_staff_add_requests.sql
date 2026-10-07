-- Staff can add a call-back request themselves (a phone call or walk-in) and allocate it straight away.
grant insert (name, phone, email, interest, office, message, franchisee_id) on consultation_requests to authenticated;
create policy staff_insert on consultation_requests for insert to authenticated
  with check (is_staff() and (my_office() is null or office = my_office()));
