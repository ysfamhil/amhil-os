-- Daily Journal — one private entry per user per day.
-- `story` is the free-form body; the other text columns are optional
-- reflections. Everything is nullable so a day can be journaled naturally
-- without filling in a form.

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null default current_date,
  title text,
  story text,
  mood text check (mood in ('great', 'productive', 'normal', 'difficult')),
  highlights text,
  challenges text,
  lessons text,
  tomorrow_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One entry per day. This unique index also serves every per-user and
  -- per-user-by-date lookup (leading column is user_id), so no separate
  -- user_id / entry_date indexes are needed.
  unique (user_id, entry_date)
);

create trigger set_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

alter table public.journal_entries enable row level security;

create policy "journal_entries: owner select" on public.journal_entries
  for select using ((select auth.uid()) = user_id);
create policy "journal_entries: owner insert" on public.journal_entries
  for insert with check ((select auth.uid()) = user_id);
create policy "journal_entries: owner update" on public.journal_entries
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_entries: owner delete" on public.journal_entries
  for delete using ((select auth.uid()) = user_id);

-- Explicit Data API grant (Supabase stops auto-granting on new public tables
-- from Oct 30, 2026). `anon` intentionally gets nothing — this is private.
grant select, insert, update, delete on public.journal_entries to authenticated;
