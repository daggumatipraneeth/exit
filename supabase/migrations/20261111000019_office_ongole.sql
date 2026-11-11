-- Ongole office opens (keep in step with src/config.js → offices).
create or replace function office_names() returns text[]
language sql immutable as $$ select array['Guntur', 'Ongole', 'Hyderabad'] $$;
