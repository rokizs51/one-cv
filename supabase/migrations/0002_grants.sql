-- 0002_grants.sql
-- Supabase no longer auto-grants tables/functions created in the SQL editor
-- (role postgres) to the app roles. Without grants, the RLS policies in 0001
-- never come into play — every authenticated API request failed with
-- 42501 insufficient_privilege (observed live: GET/POST /rest/v1/profiles
-- returning 403 while /auth/v1/user returned 200).
--
-- Applied to the dev project 2026-10-17 via the Supabase MCP (recorded in
-- the migration history); file kept in-repo so `supabase db push` stays in
-- sync on fresh projects.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on all functions in schema public to authenticated;

-- service_role (ops/backup): everything, it bypasses RLS by design.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future migrations (0003+) created as postgres get the same treatment.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
