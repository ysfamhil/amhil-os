-- Fix: tables created via `supabase db push` do not automatically pick up
-- the project's default authenticated/anon grants the way tables created
-- through the dashboard table editor do. Without this, RLS policies never
-- even get evaluated — PostgreSQL rejects the query at the privilege check,
-- before RLS is consulted at all. This blocks logged-in users from reading
-- or writing their own rows, silently, since query errors here were being
-- swallowed as empty results in application code.
--
-- The `anon` role intentionally gets nothing: this is a private, login-only
-- app, so unauthenticated requests should be rejected outright.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
