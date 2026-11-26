-- Keep existing profile rows intact. New accounts always start pending.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'user', 'pending');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy "profiles: owner insert" on public.profiles;
drop policy "profiles: owner delete" on public.profiles;
revoke insert, delete on public.profiles from public, anon, authenticated;

-- Read the caller's status without re-entering the profile policies.
create function public.is_approved_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'approved'
  );
$$;

revoke execute on function public.is_approved_account() from public, anon, authenticated;
grant execute on function public.is_approved_account() to authenticated;

alter function public.is_admin() set search_path = '';
-- The existing SELECT policy also applies to anonymous requests. Keep this
-- boolean predicate callable there so it can return false for a missing UID.
alter policy "profiles: owner update" on public.profiles
  to authenticated
  using ((select auth.uid()) = id and (select public.is_approved_account()))
  with check ((select auth.uid()) = id and (select public.is_approved_account()));

-- Run as the caller so trusted maintenance is distinguished by database role.
create or replace function public.guard_profile_role_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at
     or new.updated_at is distinct from old.updated_at then
    raise exception 'Profile identity and timestamps are managed by the system'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by then
    if old.id = (select auth.uid()) or not public.is_admin() then
      raise exception 'Only an approved administrator can change another account''s access'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_profile_role_status() from public, anon, authenticated;

-- Restrictive policies are ANDed with the existing permissive owner policies.
-- Trusted BYPASSRLS roles retain their existing behavior.
do $$
declare
  workspace_table text;
begin
  foreach workspace_table in array array[
    'tasks', 'subtasks', 'tags', 'task_tags', 'habits', 'habit_completions',
    'goals', 'projects', 'project_milestones', 'time_entries',
    'clients', 'leads', 'crm_leads', 'learning_areas', 'learning_topics', 'learning_sessions',
    'income', 'expenses', 'emergency_fund', 'emergency_fund_transactions',
    'notes', 'journal_entries', 'timeline_events', 'notifications'
  ]
  loop
    execute format(
      'create policy "workspace: approved account" on public.%I
       as restrictive for all to authenticated
       using ((select public.is_approved_account()))
       with check ((select public.is_approved_account()))',
      workspace_table
    );
  end loop;
end;
$$;
