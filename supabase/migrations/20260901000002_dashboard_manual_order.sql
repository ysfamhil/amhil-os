-- Manual drag-to-reorder on the Overview dashboard's Tasks and Goals
-- widgets needs a persisted rank per row, independent of due_date/
-- target_date (which still drive sort order everywhere else in the app).
-- Backfill existing rows in their current creation order so the first
-- reorder a user does doesn't visually jumble anything.

alter table public.tasks add column position integer not null default 0;
alter table public.goals add column position integer not null default 0;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.tasks
)
update public.tasks
set position = ranked.rn
from ranked
where public.tasks.id = ranked.id;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.goals
)
update public.goals
set position = ranked.rn
from ranked
where public.goals.id = ranked.id;
