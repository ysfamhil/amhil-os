-- AMHIL OS — Phase 8: atomic notification deduplication
--
-- The previous automation dedupe was check-then-insert (SELECT count, then
-- conditionally INSERT), which is not atomic — two concurrent dashboard
-- loads could both pass the check before either insert lands, producing
-- duplicate notifications. Replacing the rolling 3-day dedupe window with a
-- day-bucketed unique constraint lets the app use a single atomic
-- upsert-with-ignoreDuplicates call instead: Postgres itself guarantees only
-- one notification per (user, type, entity, day) can ever exist, no matter
-- how many concurrent requests try to create one.
--
-- occurred_on tracks the calendar day (not a timestamp) so the constraint
-- means "at most one of this notification per entity per day" — a slightly
-- tighter cadence than the old 3-day window, and a more useful one (a still
-- -overdue task is worth surfacing again the next day, not silenced for 3).

alter table public.notifications add column if not exists occurred_on date not null default current_date;

-- Existing rows from before this fix can already contain duplicates (this
-- is literally the bug being fixed) — remove them, keeping the earliest of
-- each group, before the unique index can be created.
delete from public.notifications a
  using public.notifications b
  where a.id > b.id
    and a.user_id = b.user_id
    and a.type = b.type
    and a.related_entity_id is not distinct from b.related_entity_id
    and a.occurred_on = b.occurred_on;

create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, type, related_entity_id, occurred_on);
