-- CRM follow-up tracking: how many follow-ups have been logged for a lead and
-- when the last one happened. Additive only; existing leads start at 0 / null.

alter table public.crm_leads
  add column follow_up_count integer not null default 0 check (follow_up_count >= 0),
  add column last_followed_up date;
