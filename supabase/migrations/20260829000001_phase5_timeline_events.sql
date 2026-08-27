-- Phase 5 (Timeline, Global Search, Reports) — additive only.
-- timeline_events and notes already exist from Phase 1 with RLS and indexes
-- matching this phase's spec closely (UUIDs, user_id-scoped, occurred_at
-- indexed desc for recent-first pagination, related_entity_type/id indexed
-- together for entity lookups).
--
-- Two gaps against this phase's spec:
--   1. No direct project_id column, so filtering the timeline "by project"
--      would require knowing, per event_type, which source table to join —
--      impossible to do generically in one query. A denormalized project_id
--      (same pattern already used by income/expenses/time_entries) makes
--      project filtering a plain indexed equality check regardless of what
--      kind of event it is.
--   2. No metadata column for flexible per-event data (amounts, durations,
--      streak counts) that the timeline UI wants to render without joining
--      back to the source table for every row.

alter table public.timeline_events
  add column project_id uuid references public.projects (id) on delete set null,
  add column metadata jsonb not null default '{}'::jsonb;

create index timeline_events_project_id_idx on public.timeline_events (project_id);
create index timeline_events_event_type_idx on public.timeline_events (event_type);
