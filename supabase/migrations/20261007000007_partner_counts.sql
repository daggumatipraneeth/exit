-- Active customers per partner, counted in the database (the Partners page used to download every customer to count them).
create view partner_customer_counts with (security_invoker = true) as
select franchisee_id, count(*)::int as active_customers
from customers
where status = 'active'
group by franchisee_id;
