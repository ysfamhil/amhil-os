-- Explicit Data API grants for tables created in the future.
--
-- Supabase is removing its automatic grants on new public tables (Oct 30,
-- 2026): a table without explicit GRANTs fails with "permission denied" via
-- the Data API, before RLS is even evaluated. Existing tables keep whatever
-- they have today, so this migration does not touch them. It only sets the
-- default privileges new tables created by migrations will inherit.
--
--   authenticated  select/insert/update/delete. Already set by
--                  20260826120000_grant_authenticated_privileges.sql (the
--                  grants on every existing table plus default privileges for
--                  future ones); not repeated here.
--   service_role   everything. The server-side key bypasses RLS by design;
--                  without this, admin/maintenance scripts get "permission
--                  denied" on new tables.
--   anon           nothing, on purpose. This is a private, login-only app and
--                  every table is per-user data.
--
-- Because authenticated gets read/write by default, EVERY new table must also
-- `enable row level security` and add owner policies in its own migration.

alter default privileges in schema public
  grant all on tables to service_role;
