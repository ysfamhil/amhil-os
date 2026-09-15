-- Replace "first signup becomes admin" with a fixed owner email.
--
-- The bootstrap logic in handle_new_user() (see 20260911000001) promoted
-- whoever signed up first on an empty database to admin. That's fine for a
-- throwaway dev database seeded from nothing, but it's the wrong rule in
-- general — anyone who won the race to sign up first would get admin. The
-- only account that should ever get it automatically is the one real owner
-- account; every other signup, first or five-thousandth, lands as a pending
-- regular user and has to be promoted deliberately (there's no promote-to-
-- admin action yet — do it with a manual update until one exists).
--
-- This also corrects the one-time backfill in 20260911000001, which
-- grandfathered in *every* pre-existing profile row as admin — right for a
-- database whose only pre-existing row is the real owner, wrong for this
-- dev database where the first test signup got backfilled the same way.
-- Demoting anyone who isn't the owner email keeps that migration safe to
-- eventually replay on the real production database, whatever test data
-- happens to exist here in the meantime.

-- guard_profile_role_status (see 20260911000001) blocks a role/status change
-- unless the acting user is already an admin — but it reads that off
-- auth.uid(), which is only populated for requests that went through the
-- PostgREST/GoTrue API layer. A direct migration connection (this file,
-- `supabase db push`, the SQL editor) has no JWT and so no auth.uid() at
-- all; without this fix the guard reads that as "an anonymous caller with
-- no admin row" and silently reverts the very fix below. Only enforce the
-- check when auth.uid() is actually set — i.e. only for real API callers,
-- which is the only path that was ever meant to be restricted.
create or replace function public.guard_profile_role_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role <> old.role or new.status <> old.status then
    if (select auth.uid()) is not null
       and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') then
      new.role := old.role;
      new.status := old.status;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner_email constant text := 'youssefamhil67+amhilostest@gmail.com';
begin
  if new.email = owner_email then
    insert into public.profiles (id, email, full_name, role, status, approved_at)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'admin', 'approved', now());
  else
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  end if;
  return new;
end;
$$;

update public.profiles
set role = 'user', status = 'pending', approved_at = null, approved_by = null
where role = 'admin' and email is distinct from 'youssefamhil67+amhilostest@gmail.com';
