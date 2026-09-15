-- Fix: "profiles: admin select all" / "admin update all" embedded their
-- `exists (select 1 from profiles ...)` check directly in the policy, so
-- Postgres re-ran RLS on that very subquery — which re-evaluates the same
-- admin policy again, and so on: "infinite recursion detected in policy for
-- relation profiles" (42P17) on every query, for every user, admin or not.
--
-- The fix is the standard one: move the check into a SECURITY DEFINER
-- function. Functions created here run as the migration role (which
-- bypasses RLS), so the SELECT inside `is_admin()` never re-triggers the
-- policy that calls it — one evaluation, no recursion.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

drop policy if exists "profiles: admin select all" on public.profiles;
drop policy if exists "profiles: admin update all" on public.profiles;

create policy "profiles: admin select all" on public.profiles for select
  using (public.is_admin());

create policy "profiles: admin update all" on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
