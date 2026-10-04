-- When a lead enters a new status it starts that status with a clean slate:
-- follow-ups logged while Contacted shouldn't count toward the Mockup sent
-- follow-ups (and vice versa). Extends the existing status_changed_at trigger
-- function; the trigger itself is unchanged.

create or replace function public.crm_leads_touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := current_date;
    new.follow_up_count := 0;
    new.last_followed_up := null;
  end if;
  return new;
end;
$$;
