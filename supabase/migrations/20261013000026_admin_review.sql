-- Admin review of an application.
-- 1. Rejecting needs a reason; the partner sees it on the customer page. Reopening clears it.
-- 2. Once the customer has signed, changing what they agreed to (name, PAN, partner, cap %, plan or capital)
--    sends the application back to draft, so a new link is made and they sign the updated agreement.
--    Before signing nothing is needed: the agreement is rendered with the current details at signing time.

alter table customers add column reject_reason text;
grant select (reject_reason), update (reject_reason) on customers to authenticated;

create function customer_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'customer_capital' then
    update customers set status = 'draft' where id = coalesce(new.customer_id, old.customer_id) and status = 'pending_approval';
    return null;
  end if;
  if new.status = 'rejected' then
    if old.status <> 'rejected' and auth.uid() is not null and coalesce(trim(new.reject_reason), '') = '' then
      raise exception 'Give a reason for rejecting';
    end if;
  else
    new.reject_reason := null;
  end if;
  if old.status = 'pending_approval' and new.status = 'pending_approval'
     and (new.full_name, new.pan_hash, new.franchisee_id, new.cap_pct, new.plan)
         is distinct from (old.full_name, old.pan_hash, old.franchisee_id, old.cap_pct, old.plan) then
    new.status := 'draft';
  end if;
  return new;
end $$;

create trigger review before update on customers for each row execute function customer_review();
create trigger review after insert or update or delete on customer_capital for each row execute function customer_review();
