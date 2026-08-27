-- AMHIL OS — Phase 7: production hardening
-- Schema corrections and gaps found during the Phase 7 full-application audit.
-- No behavioral/feature changes — only fixes for drift risk, missing indexes,
-- and RLS-policy completeness.

-- ---------------------------------------------------------------------------
-- tasks.actual_minutes was never written by any code path (confirmed by
-- audit): every task-time report was silently reading a permanently-null
-- column instead of the real time_entries total. Reports now derive actual
-- minutes live from time_entries, so this dead, misleading column is removed
-- rather than wired up to a sync trigger — consistent with this app's rule
-- that derived/financial values are always computed live, never stored.
-- ---------------------------------------------------------------------------
alter table public.tasks drop column if exists actual_minutes;

-- ---------------------------------------------------------------------------
-- Missing indexes on commonly filtered/sorted columns
-- ---------------------------------------------------------------------------
create index if not exists goals_target_date_idx on public.goals (target_date);
create index if not exists project_milestones_due_date_idx on public.project_milestones (due_date);
create index if not exists project_milestones_status_idx on public.project_milestones (status);
create index if not exists habits_is_active_idx on public.habits (is_active);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists notes_created_at_idx on public.notes (created_at desc);
-- task_tags' composite primary key (task_id, tag_id) doesn't serve reverse
-- "which tasks have this tag" lookups efficiently.
create index if not exists task_tags_tag_id_idx on public.task_tags (tag_id);

-- ---------------------------------------------------------------------------
-- habit_completions and notifications both have mutable fields
-- (is_completed/note, is_read) but never got an updated_at column — add both,
-- matching every other table's pattern.
-- ---------------------------------------------------------------------------
alter table public.habit_completions add column if not exists updated_at timestamptz not null default now();
create trigger set_updated_at before update on public.habit_completions
  for each row execute function public.set_updated_at();

alter table public.notifications add column if not exists updated_at timestamptz not null default now();
create trigger set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles was missing insert/delete policies (only had select/update).
-- Insert already happens via the security-definer handle_new_user trigger,
-- but an explicit self-service policy is more consistent with every other
-- table and lets a user manage their own profile row directly if ever needed.
-- ---------------------------------------------------------------------------
create policy "profiles: owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner delete" on public.profiles for delete using (auth.uid() = id);
