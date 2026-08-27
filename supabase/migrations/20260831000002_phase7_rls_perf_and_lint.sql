-- AMHIL OS — Phase 7: RLS performance + security-lint fixes
-- Found via `supabase db advisors` during the Phase 7 audit.

-- ---------------------------------------------------------------------------
-- auth_rls_initplan (83 occurrences): every owner-scoped RLS policy wrote
-- `auth.uid() = user_id` directly, which Postgres re-evaluates once PER ROW
-- scanned. Wrapping it as `(select auth.uid())` lets the planner evaluate it
-- once per query via an InitPlan instead — same security semantics (it's
-- still exactly the current user's id), strictly better performance as
-- tables grow. This rewrites every policy created by the Phase 1 generic
-- loop, plus task_tags, notifications, and profiles, which were written out
-- individually.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','leads','goals','projects','project_milestones','tasks','subtasks',
    'tags','learning_areas','learning_topics','learning_sessions','habits',
    'habit_completions','time_entries','income','expenses','notes','timeline_events'
  ]
  loop
    execute format('drop policy if exists "%1$s: owner select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: owner insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: owner update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s: owner delete" on public.%1$s', t);

    execute format(
      'create policy "%1$s: owner select" on public.%1$s for select using ((select auth.uid()) = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner insert" on public.%1$s for insert with check ((select auth.uid()) = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner update" on public.%1$s for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner delete" on public.%1$s for delete using ((select auth.uid()) = user_id)', t
    );
  end loop;
end $$;

drop policy if exists "task_tags: owner select" on public.task_tags;
drop policy if exists "task_tags: owner insert" on public.task_tags;
drop policy if exists "task_tags: owner delete" on public.task_tags;

create policy "task_tags: owner select" on public.task_tags for select
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));
create policy "task_tags: owner insert" on public.task_tags for insert
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));
create policy "task_tags: owner delete" on public.task_tags for delete
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));

drop policy if exists "notifications: owner select" on public.notifications;
drop policy if exists "notifications: owner insert" on public.notifications;
drop policy if exists "notifications: owner update" on public.notifications;
drop policy if exists "notifications: owner delete" on public.notifications;

create policy "notifications: owner select" on public.notifications for select using ((select auth.uid()) = user_id);
create policy "notifications: owner insert" on public.notifications for insert with check ((select auth.uid()) = user_id);
create policy "notifications: owner update" on public.notifications for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notifications: owner delete" on public.notifications for delete using ((select auth.uid()) = user_id);

drop policy if exists "profiles: owner read" on public.profiles;
drop policy if exists "profiles: owner update" on public.profiles;
drop policy if exists "profiles: owner insert" on public.profiles;
drop policy if exists "profiles: owner delete" on public.profiles;

create policy "profiles: owner read" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles: owner update" on public.profiles for update using ((select auth.uid()) = id);
create policy "profiles: owner insert" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "profiles: owner delete" on public.profiles for delete using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- function_search_path_mutable: set_updated_at had no explicit search_path,
-- so it resolves unqualified names against whatever search_path the calling
-- session happens to have — a session-level search_path could in principle
-- redirect that resolution. It only ever touches NEW/OLD record fields with
-- no unqualified lookups, but pinning search_path is the standard fix.
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = '';

-- ---------------------------------------------------------------------------
-- anon/authenticated_security_definer_function_executable: handle_new_user
-- is a trigger function (only ever invoked by the on_auth_user_created
-- trigger), but Postgres grants EXECUTE on new functions to PUBLIC by
-- default, which the linter flags as directly callable via
-- /rest/v1/rpc/handle_new_user. Calling a trigger function outside trigger
-- context already fails at runtime, but revoking EXECUTE removes the
-- exposed surface entirely rather than relying on that.
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
