-- AMHIL OS — Emergency Fund
--
-- A dedicated savings tracker, kept separate from income/expenses so a
-- contribution doesn't distort the monthly finance totals: money moved into
-- the emergency fund is saved, not spent. `emergency_fund` holds the one
-- editable setting (the target amount) per user, created lazily the first
-- time it's changed from the default. `emergency_fund_transactions` is an
-- append-only ledger — deposits positive, withdrawals negative — and the
-- current balance is always SUM(amount), derived on read rather than cached,
-- the same approach the Finance widget already uses for its monthly totals.

create table public.emergency_fund (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  target_amount numeric(12,2) not null default 5000 check (target_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.emergency_fund
  for each row execute function public.set_updated_at();

create table public.emergency_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index emergency_fund_transactions_user_id_idx on public.emergency_fund_transactions (user_id);
create index emergency_fund_transactions_created_at_idx on public.emergency_fund_transactions (created_at);

create trigger set_updated_at before update on public.emergency_fund_transactions
  for each row execute function public.set_updated_at();

alter table public.emergency_fund enable row level security;
alter table public.emergency_fund_transactions enable row level security;

create policy "emergency_fund: owner select" on public.emergency_fund for select using ((select auth.uid()) = user_id);
create policy "emergency_fund: owner insert" on public.emergency_fund for insert with check ((select auth.uid()) = user_id);
create policy "emergency_fund: owner update" on public.emergency_fund for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "emergency_fund: owner delete" on public.emergency_fund for delete using ((select auth.uid()) = user_id);

create policy "emergency_fund_transactions: owner select" on public.emergency_fund_transactions for select using ((select auth.uid()) = user_id);
create policy "emergency_fund_transactions: owner insert" on public.emergency_fund_transactions for insert with check ((select auth.uid()) = user_id);
create policy "emergency_fund_transactions: owner update" on public.emergency_fund_transactions for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "emergency_fund_transactions: owner delete" on public.emergency_fund_transactions for delete using ((select auth.uid()) = user_id);
