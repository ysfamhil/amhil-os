-- E-mails about accounts: tell the administrator that someone is waiting for approval, and tell a
-- user when their access changes.
--
-- Triggers only add a row to a private queue, so a change made in the app, in the dashboard or in
-- SQL is covered alike, and an e-mail problem can never fail a sign-up or an approval. A job then
-- hands queued rows to the application (/app/api/account-email), which sends them through Resend.
--
-- Nothing is sent until two Vault secrets exist, 'account_email_endpoint' (the route's URL) and
-- 'account_email_secret' (shared with the application). They are created by hand, never committed.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema account_email_private;
revoke all on schema account_email_private from public, anon, authenticated;

create table account_email_private.outbox (
  id uuid primary key default gen_random_uuid(),
  -- order of events; several can share one transaction time
  seq bigint generated always as identity,
  kind text not null check (kind in (
    'admin_new_registration', 'account_approved', 'account_declined', 'account_suspended', 'account_restored'
  )),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- the account's address and name when the event happened
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  request_id bigint,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text
);
alter table account_email_private.outbox enable row level security;
revoke all on account_email_private.outbox from public, anon, authenticated;

-- The administrator hears about each registration once.
create unique index outbox_one_registration_per_user
  on account_email_private.outbox (user_id) where kind = 'admin_new_registration';
create index outbox_open on account_email_private.outbox (next_attempt_at)
  where sent_at is null and failed_at is null;
create index outbox_user on account_email_private.outbox (user_id, seq);

-- Only confirmed addresses are ever written to: anyone can type someone else's address into a form.
create function account_email_private.enqueue(p_kind text, p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into account_email_private.outbox (kind, user_id, email, full_name)
  select p_kind, u.id, u.email, left(p.full_name, 80)
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = p_user and coalesce(u.email, '') <> '' and u.email_confirmed_at is not null
  on conflict (user_id) where kind = 'admin_new_registration' do nothing;
$$;

-- A registration counts once its address is confirmed.
create function account_email_private.on_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null)
     and exists (select 1 from public.profiles where id = new.id and status = 'pending') then
    perform account_email_private.enqueue('admin_new_registration', new.id);
  end if;
  return null;
exception when others then
  raise warning 'account e-mail not queued (%)', sqlstate;
  return null;
end;
$$;

create function account_email_private.on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if old.status = 'pending' and new.status = 'approved' then
    v_kind := 'account_approved';
  elsif old.status = 'pending' and new.status = 'suspended' then
    v_kind := 'account_declined';
  elsif old.status = 'approved' and new.status = 'suspended' then
    v_kind := 'account_suspended';
  elsif old.status = 'suspended' and new.status = 'approved' then
    -- Someone who was declined and is accepted after all never had access to "restore".
    v_kind := case
      when (select kind from account_email_private.outbox
            where user_id = new.id and kind <> 'admin_new_registration'
            order by seq desc limit 1) = 'account_declined' then 'account_approved'
      else 'account_restored'
    end;
  end if;

  if v_kind is not null then
    perform account_email_private.enqueue(v_kind, new.id);
  end if;
  return null;
exception when others then
  raise warning 'account e-mail not queued (%)', sqlstate;
  return null;
end;
$$;

-- "on_auth_user_registration_alert" sorts after "on_auth_user_created", so the profile exists.
create trigger on_auth_user_registration_alert
  after insert or update of email_confirmed_at on auth.users
  for each row execute function account_email_private.on_user_confirmed();

create trigger account_email_on_status_change
  after update of status on public.profiles
  for each row execute function account_email_private.on_status_change();

-- Runs every minute: record the outcome of earlier requests, give up on stale ones, send what is due.
-- Every attempt for a row carries its id, which the application uses as Resend's idempotency key.
create function account_email_private.dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  r record;
begin
  update account_email_private.outbox o
  set sent_at = now(), request_id = null, last_error = null
  from net._http_response h
  where o.sent_at is null and o.failed_at is null
    and h.id = o.request_id and h.created >= o.last_attempt_at
    and h.status_code between 200 and 299;

  -- Failed, or no answer recorded after two minutes: try again after 1, 5, 30 and 120 minutes, five
  -- attempts in all.
  update account_email_private.outbox o
  set request_id = null,
      last_error = coalesce(
        (select coalesce('HTTP ' || h.status_code, h.error_msg) from net._http_response h where h.id = o.request_id),
        'no response'),
      failed_at = case when o.attempts >= 5 then now() end,
      next_attempt_at = now() + (array['1 minute', '5 minutes', '30 minutes', '2 hours'])[least(greatest(o.attempts, 1), 4)]::interval
  where o.sent_at is null and o.failed_at is null and o.request_id is not null
    and (exists (select 1 from net._http_response h
                 where h.id = o.request_id and h.created >= o.last_attempt_at)
         or o.last_attempt_at < now() - interval '2 minutes');

  -- Resend remembers an idempotency key for 24 hours; later retries could send twice, and week-old
  -- news is not worth sending.
  update account_email_private.outbox
  set failed_at = now(), last_error = coalesce(last_error, 'expired')
  where sent_at is null and failed_at is null and request_id is null
    and created_at < now() - interval '24 hours';

  -- Housekeeping: no addresses kept for longer than needed, no ever-growing job log.
  delete from account_email_private.outbox
  where coalesce(sent_at, failed_at) < now() - interval '90 days';
  delete from cron.job_run_details
  where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname = 'account-email-dispatch');

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'account_email_endpoint';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'account_email_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  for r in
    select id, kind, email, full_name from account_email_private.outbox
    where sent_at is null and failed_at is null and request_id is null and next_attempt_at <= now()
    order by seq
    limit 10
    for update skip locked
  loop
    update account_email_private.outbox
    set attempts = attempts + 1,
        last_attempt_at = now(),
        request_id = net.http_post(
          url := v_url,
          body := jsonb_build_object('id', r.id, 'kind', r.kind, 'email', r.email, 'name', r.full_name),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-account-email-secret', v_secret),
          timeout_milliseconds := 10000)
    where id = r.id;
  end loop;
end;
$$;

revoke execute on all functions in schema account_email_private from public, anon, authenticated;

select cron.schedule('account-email-dispatch', '* * * * *', 'select account_email_private.dispatch()');
