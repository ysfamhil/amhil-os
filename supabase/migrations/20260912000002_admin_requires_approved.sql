-- Close a gap found in final review: every admin check so far short-circuits
-- on role = 'admin' alone, ignoring status. There's only one admin today and
-- self-suspend is already blocked in the app layer, so this isn't reachable
-- yet — but the product is explicitly meant to support promoting more admins
-- later, and once a second admin exists, one admin could suspend another,
-- and that suspended admin would keep full dashboard access, /admin access,
-- and the ability to read/write every profile via RLS, since nothing checked
-- status. Requiring status = 'approved' everywhere role = 'admin' was
-- checked closes that off before it's ever exploitable.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.guard_profile_role_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role <> old.role or new.status <> old.status then
    if (select auth.uid()) is not null
       and not exists (
         select 1 from public.profiles p
         where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'approved'
       ) then
      new.role := old.role;
      new.status := old.status;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;
  return new;
end;
$$;
