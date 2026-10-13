-- The books balance: check_books() lists every broken money rule; none on the seed. Run: npx supabase test db
-- (scripts/fuzz-payouts.mjs runs the same check after hundreds of random scenarios.)
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select is_empty('select * from check_books()', 'every money rule holds on the seed data');
select * from finish();
rollback;
