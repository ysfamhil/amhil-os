-- Emergency Fund — support multiple funds per user.
-- `emergency_fund` was created with `user_id unique`, allowing exactly one
-- fund per user, and `emergency_fund_transactions` had no link to a specific
-- fund at all (balance was always SUM of every transaction the user owned).
-- This migration is additive + backfill only: every existing fund row and
-- transaction is preserved, and any user who has transactions but never set
-- a target (so no `emergency_fund` row exists yet, since that row was only
-- ever created lazily via upsert) gets one created for them here — nothing
-- is deleted or reset.

alter table public.emergency_fund add column name text not null default 'Emergency Fund';

insert into public.emergency_fund (user_id, target_amount, name)
select distinct t.user_id, 5000, 'Emergency Fund'
from public.emergency_fund_transactions t
left join public.emergency_fund f on f.user_id = t.user_id
where f.id is null;

alter table public.emergency_fund_transactions
  add column fund_id uuid references public.emergency_fund (id);

update public.emergency_fund_transactions t
set fund_id = f.id
from public.emergency_fund f
where f.user_id = t.user_id and t.fund_id is null;

alter table public.emergency_fund_transactions alter column fund_id set not null;
create index emergency_fund_transactions_fund_id_idx on public.emergency_fund_transactions (fund_id);

alter table public.emergency_fund drop constraint emergency_fund_user_id_key;
create index emergency_fund_user_id_idx on public.emergency_fund (user_id);
