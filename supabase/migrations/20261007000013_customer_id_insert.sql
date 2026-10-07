-- Allow a client-chosen id on insert (as before 20261007000011); the encrypted columns stay excluded.
grant insert (id) on customers to authenticated;
