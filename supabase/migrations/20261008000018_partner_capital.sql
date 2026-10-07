-- Each partner's capital on a trading day, counted the same way payouts are: active customers who have
-- started by that day, at their capital for the month. Daily entry uses it to split one total across partners.
create function partner_capital_on(p_date date)
returns table (franchisee_id uuid, capital numeric)
language sql stable set search_path = public as $$
  select c.franchisee_id, sum(capital_for_month(c.id, date_trunc('month', p_date)::date))
  from customers c
  where c.status = 'active'
    and (select min(effective_from) from customer_capital where customer_id = c.id) <= p_date
  group by c.franchisee_id
$$;
revoke execute on function partner_capital_on(date) from public, anon;
grant execute on function partner_capital_on(date) to authenticated;
