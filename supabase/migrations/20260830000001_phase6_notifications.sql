-- Phase 6 (AI, Advanced Analytics, Data Export, Automation) — additive only.
-- The only new table this phase needs is `notifications`, produced by the
-- lightweight on-demand automation checks (overdue tasks, stale projects,
-- habit reminders, etc.) and read by the notification bell in the topbar.
--
-- No `ai_conversations`/`ai_messages` tables: the assistant is a quick
-- Q&A tool over existing data, not a persistent chat companion, so there is
-- no genuinely useful history to store — conversation state lives in the
-- browser for the current page visit only.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_is_read_idx on public.notifications (is_read);
create index notifications_created_at_idx on public.notifications (created_at desc);
create index notifications_type_idx on public.notifications (type);

alter table public.notifications enable row level security;

create policy "notifications: owner select" on public.notifications for select
  using (auth.uid() = user_id);
create policy "notifications: owner insert" on public.notifications for insert
  with check (auth.uid() = user_id);
create policy "notifications: owner update" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications: owner delete" on public.notifications for delete
  using (auth.uid() = user_id);
