-- Column-level revokes don't override a table-wide grant, so 20261007000010 left the encrypted columns readable
-- (ciphertext only, but they should never reach the browser). Replace the table-wide grants with
-- column lists that leave the encrypted columns out.

revoke select, insert, update on customers from anon, authenticated;
grant select (id, franchisee_id, full_name, phone, email, dob, address, cap_pct, status, created_by, created_at)
  on customers to authenticated;
grant insert (franchisee_id, full_name, phone, email, dob, address, cap_pct, status)
  on customers to authenticated;
grant update (franchisee_id, full_name, phone, email, dob, address, cap_pct, status)
  on customers to authenticated;

revoke select, insert, update on agreements from anon, authenticated;
grant select (id, customer_id, template_version, sign_token, token_expires_at, html_sha256, signature_png,
              signed_at, signer_ip, signer_user_agent, signer_name, created_at)
  on agreements to authenticated;
