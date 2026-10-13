-- New enum values must be committed before use, so they get their own migration.
alter type user_role add value 'customer';        -- a customer's own login (mobile number + password)
alter type customer_status add value 'closed';    -- withdrew everything; keeps history, leaves the payout split
