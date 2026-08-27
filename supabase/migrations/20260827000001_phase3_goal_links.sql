-- Phase 3 (Goals, Learning, Habits, Time Tracking) — additive only.
-- All seven tables this phase needs (goals, learning_areas, learning_topics,
-- learning_sessions, habits, habit_completions, time_entries), their indexes,
-- RLS policies, and most constraints already exist from the Phase 1 migration.
-- Two gaps remain:
--
-- 1. Task and Project already link to goals (goal_id, on delete set null —
--    deleting a goal must not delete the work under it). Learning topics and
--    habits were missing that same link; add it here with the same
--    on-delete behavior for consistency.
-- 2. goals.status used 'Abandoned'; the current spec calls for 'Cancelled'.
--    No goals exist yet in production, so this is a safe in-place rename.

alter table public.learning_topics
  add column goal_id uuid references public.goals (id) on delete set null;

create index learning_topics_goal_id_idx on public.learning_topics (goal_id);

alter table public.habits
  add column goal_id uuid references public.goals (id) on delete set null;

create index habits_goal_id_idx on public.habits (goal_id);

alter table public.goals
  drop constraint goals_status_check;

alter table public.goals
  add constraint goals_status_check
  check (status in ('Not Started', 'In Progress', 'Completed', 'Cancelled'));
