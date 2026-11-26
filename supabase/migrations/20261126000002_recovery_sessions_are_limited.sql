-- A session that came from an e-mail link (password recovery, confirmation) may set a password but
-- must not reach data or use administrator powers.
--
-- Supabase records how a session signed in in the signed token's "amr" claim. This application's
-- only sign-in method is e-mail and password, so a token that carries amr without "password" is an
-- e-mail-link session. Tokens without the claim (not issued by Supabase Auth, e.g. test harnesses
-- and maintenance) are unaffected. If another sign-in method is ever added, list it here too.
--
-- Every workspace policy and backup function goes through is_approved_account(), and every
-- administrator policy and trigger through is_admin(); privileges and settings are unchanged.
create or replace function public.is_approved_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.jwt() -> 'amr') is null or (select auth.jwt() -> 'amr') @> '[{"method":"password"}]'::jsonb)
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and status = 'approved'
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.jwt() -> 'amr') is null or (select auth.jwt() -> 'amr') @> '[{"method":"password"}]'::jsonb)
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin' and status = 'approved'
    );
$$;
