-- Phase 4 (Clients, Leads, Finance) — additive only.
-- clients, leads, income, and expenses already exist from Phase 1 with RLS,
-- indexes, and constraints matching this phase's spec exactly (money already
-- uses numeric(12,2), never float; income/expenses already link to clients
-- and projects with on-delete-set-null so financial history survives a
-- parent being removed).
--
-- The one gap: leads have no way to record which client they became.
-- on delete set null preserves the lead's own history (source, notes,
-- estimated value) even if the resulting client is later deleted.

alter table public.leads
  add column converted_client_id uuid references public.clients (id) on delete set null;

create index leads_converted_client_id_idx on public.leads (converted_client_id);
