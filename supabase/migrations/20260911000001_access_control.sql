-- AMHIL OS — Access control (admin approval gate)
--
-- Turns AMHIL OS from single-owner into an approval-gated product: new
-- signups land as `pending` and can't reach the dashboard until an admin
-- approves them. Whoever already has a profile row when this migration runs
-- (the current owner, on whichever database it's applied to) is grandfathered
-- in as an approved admin — no manual bootstrap step needed. On a fresh,
-- empty database the same bootstrap happens the other way: the very first
-- person to ever sign up becomes the admin, handled in handle_new_user()
-- below, since the backfill below has nothing to promote yet.

alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users (id) on delete set null;

update public.profiles set role = 'admin', status = 'approved', approved_at = now();

create index profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- handle_new_user: bootstrap the first-ever signup as an approved admin;
-- everyone after that lands as a pending regular user, same as the column
-- defaults already say — spelled out here so the bootstrap case is explicit.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, full_name, role, status, approved_at)
    values (new.id, new.raw_user_meta_data ->> 'full_name', 'admin', 'approved', now());
  else
    insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data ->> 'full_name');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A user's own RLS "update own row" policy is scoped by row (id = auth.uid())
-- with no column restriction, so without this trigger anyone could grant
-- themselves admin/approved with a plain `.update()` from the browser. This
-- silently reverts role/status changes on a row unless the caller already
-- has role = 'admin' — the one server-side gate that actually matters here,
-- independent of which RLS policy let the UPDATE through.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role <> old.role or new.status <> old.status then
    if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') then
      new.role := old.role;
      new.status := old.status;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_role_status before update on public.profiles
  for each row execute function public.guard_profile_role_status();

-- ---------------------------------------------------------------------------
-- Admin read/update access to every profile (for the approval queue and user
-- stats), layered on top of the existing owner-only policies — Postgres ORs
-- policies for the same command together, so a row is visible/writable if it
-- satisfies either "it's mine" or "I'm an admin". Admin reach stops at
-- `profiles`: every other table (tasks, goals, notes, ...) keeps its
-- existing owner-only policies untouched, so approving a user never grants
-- visibility into their actual data.
-- ---------------------------------------------------------------------------
create policy "profiles: admin select all" on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "profiles: admin update all" on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
