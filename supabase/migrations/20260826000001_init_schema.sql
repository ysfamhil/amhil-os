-- AMHIL OS — Initial schema (Phase 1)
-- Database-first: this is the single source of truth for all app data.
-- Every owned table carries user_id (defaulting to auth.uid()) so RLS can
-- scope rows per-user today while leaving room for multi-user later.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at current on every row update
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  country text,
  source text,
  status text not null default 'Lead'
    check (status in ('Lead','Contacted','Proposal','Negotiation','Won','Lost','Client','Inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_user_id_idx on public.clients (user_id);
create index clients_status_idx on public.clients (status);

create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  company text,
  contact text,
  source text,
  status text not null default 'Lead'
    check (status in ('Lead','Contacted','Proposal','Negotiation','Won','Lost')),
  estimated_value numeric(12,2),
  notes text,
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_user_id_idx on public.leads (user_id);
create index leads_status_idx on public.leads (status);

create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category text,
  start_date date,
  target_date date,
  status text not null default 'Not Started'
    check (status in ('Not Started','In Progress','Completed','Abandoned')),
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals (user_id);
create index goals_status_idx on public.goals (status);

create trigger set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'Idea'
    check (status in ('Idea','Planned','Active','On Hold','Completed','Archived')),
  start_date date,
  target_date date,
  completed_at timestamptz,
  client_id uuid references public.clients (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  category text,
  budget numeric(12,2),
  estimated_hours numeric(8,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);
create index projects_status_idx on public.projects (status);
create index projects_client_id_idx on public.projects (client_id);
create index projects_goal_id_idx on public.projects (goal_id);

create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- project_milestones
-- ---------------------------------------------------------------------------
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  completed_at timestamptz,
  status text not null default 'Planned'
    check (status in ('Planned','In Progress','Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_milestones_user_id_idx on public.project_milestones (user_id);
create index project_milestones_project_id_idx on public.project_milestones (project_id);

create trigger set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'Todo'
    check (status in ('Backlog','Todo','In Progress','Waiting','Done','Cancelled')),
  priority text not null default 'Medium'
    check (priority in ('Low','Medium','High','Urgent')),
  due_date date,
  completed_at timestamptz,
  estimated_minutes integer check (estimated_minutes >= 0),
  actual_minutes integer check (actual_minutes >= 0),
  project_id uuid references public.projects (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_priority_idx on public.tasks (priority);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_goal_id_idx on public.tasks (goal_id);

create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subtasks
-- ---------------------------------------------------------------------------
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subtasks_user_id_idx on public.subtasks (user_id);
create index subtasks_task_id_idx on public.subtasks (task_id);

create trigger set_updated_at before update on public.subtasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags + task_tags (join table)
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index tags_user_id_idx on public.tags (user_id);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- learning_areas / learning_topics / learning_sessions
-- ---------------------------------------------------------------------------
create table public.learning_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_areas_user_id_idx on public.learning_areas (user_id);

create trigger set_updated_at before update on public.learning_areas
  for each row execute function public.set_updated_at();

create table public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.learning_areas (id) on delete cascade,
  name text not null,
  status text not null default 'Not Started'
    check (status in ('Not Started','Learning','Practicing','Completed','Reviewing')),
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  confidence numeric(3,1) check (confidence between 0 and 10),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_topics_user_id_idx on public.learning_topics (user_id);
create index learning_topics_area_id_idx on public.learning_topics (area_id);
create index learning_topics_status_idx on public.learning_topics (status);

create trigger set_updated_at before update on public.learning_topics
  for each row execute function public.set_updated_at();

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id uuid not null references public.learning_topics (id) on delete cascade,
  date date not null default current_date,
  duration_minutes integer not null check (duration_minutes > 0),
  notes text,
  what_learned text,
  confidence_before numeric(3,1) check (confidence_before between 0 and 10),
  confidence_after numeric(3,1) check (confidence_after between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_sessions_user_id_idx on public.learning_sessions (user_id);
create index learning_sessions_topic_id_idx on public.learning_sessions (topic_id);
create index learning_sessions_date_idx on public.learning_sessions (date);

create trigger set_updated_at before update on public.learning_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- habits / habit_completions
-- ---------------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily','weekly','custom')),
  target integer not null default 1 check (target > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_user_id_idx on public.habits (user_id);

create trigger set_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  is_completed boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index habit_completions_user_id_idx on public.habit_completions (user_id);
create index habit_completions_habit_id_idx on public.habit_completions (habit_id);
create index habit_completions_date_idx on public.habit_completions (date);

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  category text,
  date date not null default current_date,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer not null check (duration_minutes > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_user_id_idx on public.time_entries (user_id);
create index time_entries_project_id_idx on public.time_entries (project_id);
create index time_entries_task_id_idx on public.time_entries (task_id);
create index time_entries_date_idx on public.time_entries (date);

create trigger set_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- income / expenses
-- ---------------------------------------------------------------------------
create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'MAD',
  date date not null default current_date,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  source text,
  description text,
  status text not null default 'Expected'
    check (status in ('Expected','Invoiced','Paid','Cancelled')),
  payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_user_id_idx on public.income (user_id);
create index income_date_idx on public.income (date);
create index income_client_id_idx on public.income (client_id);
create index income_project_id_idx on public.income (project_id);
create index income_status_idx on public.income (status);

create trigger set_updated_at before update on public.income
  for each row execute function public.set_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'MAD',
  date date not null default current_date,
  category text,
  project_id uuid references public.projects (id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_id_idx on public.expenses (user_id);
create index expenses_date_idx on public.expenses (date);
create index expenses_project_id_idx on public.expenses (project_id);

create trigger set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  content text,
  tags text[] not null default '{}',
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  learning_topic_id uuid references public.learning_topics (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_idx on public.notes (user_id);
create index notes_project_id_idx on public.notes (project_id);
create index notes_task_id_idx on public.notes (task_id);
create index notes_learning_topic_id_idx on public.notes (learning_topic_id);
create index notes_client_id_idx on public.notes (client_id);
create index notes_goal_id_idx on public.notes (goal_id);
create index notes_tags_idx on public.notes using gin (tags);

create trigger set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- timeline_events — append-only activity log
-- ---------------------------------------------------------------------------
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index timeline_events_user_id_idx on public.timeline_events (user_id);
create index timeline_events_occurred_at_idx on public.timeline_events (occurred_at desc);
create index timeline_events_related_entity_idx on public.timeline_events (related_entity_type, related_entity_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — single-user today, ready for multi-user later
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.goals enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.learning_areas enable row level security;
alter table public.learning_topics enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.time_entries enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.notes enable row level security;
alter table public.timeline_events enable row level security;

create policy "profiles: owner read" on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id);

-- generic owner-scoped policy for every user_id-owned table
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
    execute format(
      'create policy "%1$s: owner select" on public.%1$s for select using (auth.uid() = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner insert" on public.%1$s for insert with check (auth.uid() = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner update" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t
    );
    execute format(
      'create policy "%1$s: owner delete" on public.%1$s for delete using (auth.uid() = user_id)', t
    );
  end loop;
end $$;

-- task_tags has no user_id of its own — scope through the parent task
alter table public.task_tags enable row level security;

create policy "task_tags: owner select" on public.task_tags for select
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));
create policy "task_tags: owner insert" on public.task_tags for insert
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));
create policy "task_tags: owner delete" on public.task_tags for delete
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));
