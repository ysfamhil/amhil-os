-- CRM: when did a lead enter its current status? The follow-up rules count
-- from this date, not from the lead's own `date` (when it was first found).
-- Maintained by a trigger so every path that changes status (Kanban drag,
-- table dropdown, edit form) is covered without app code having to remember.

alter table public.crm_leads add column status_changed_at date;

-- Backfill existing leads with their own date. Pause the updated_at trigger so
-- the backfill doesn't rewrite every lead's updated_at timestamp.
alter table public.crm_leads disable trigger set_updated_at;
update public.crm_leads set status_changed_at = date;
alter table public.crm_leads enable trigger set_updated_at;

alter table public.crm_leads
  alter column status_changed_at set not null,
  alter column status_changed_at set default current_date;

create or replace function public.crm_leads_touch_status_changed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := current_date;
  end if;
  return new;
end;
$$;

create trigger crm_leads_status_changed_at before update on public.crm_leads
  for each row execute function public.crm_leads_touch_status_changed_at();
