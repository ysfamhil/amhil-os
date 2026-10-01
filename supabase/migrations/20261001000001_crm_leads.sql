-- CRM — outreach leads for SaaS/website-design prospecting.
-- Deliberately separate from the pre-existing `leads`/`clients` tables (a
-- general sales pipeline with Proposal/Negotiation stages and client
-- conversion, added in 20260826000001_init_schema.sql / 20260828000001).
-- Those are left completely untouched and may still be used later for a
-- broader client/sales pipeline — this is a narrower, fixed-pipeline table
-- for a single outreach workflow with its own status set and fields
-- (website_url, a single editable date) that don't fit the existing shape.

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  website_url text,
  contact text,
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Replied', 'Mockup sent', 'Won', 'Lost')),
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_leads_user_id_idx on public.crm_leads (user_id);
create index crm_leads_status_idx on public.crm_leads (status);

create trigger set_updated_at before update on public.crm_leads
  for each row execute function public.set_updated_at();

alter table public.crm_leads enable row level security;

create policy "crm_leads: owner select" on public.crm_leads
  for select using ((select auth.uid()) = user_id);
create policy "crm_leads: owner insert" on public.crm_leads
  for insert with check ((select auth.uid()) = user_id);
create policy "crm_leads: owner update" on public.crm_leads
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "crm_leads: owner delete" on public.crm_leads
  for delete using ((select auth.uid()) = user_id);
