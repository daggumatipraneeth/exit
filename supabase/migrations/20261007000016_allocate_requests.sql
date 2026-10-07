-- Exit staff allocate a website call-back request to a partner, who then sees it and can update it.

alter table consultation_requests add column franchisee_id uuid references franchisees on delete set null;
create index on consultation_requests (franchisee_id);
grant update (franchisee_id) on consultation_requests to authenticated;

create policy partner_read on consultation_requests for select to authenticated
  using (franchisee_id = my_franchisee_id());
-- with check keeps it theirs: a partner can't hand a request on or drop it, only update status and notes.
create policy partner_update on consultation_requests for update to authenticated
  using (franchisee_id = my_franchisee_id()) with check (franchisee_id = my_franchisee_id());

