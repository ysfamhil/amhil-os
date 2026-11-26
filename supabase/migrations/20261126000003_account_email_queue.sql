-- E-mails about accounts: tell the administrator that someone is waiting for approval, and tell a
-- user when their access changes.
--
-- Triggers only add a row to a private queue, so a change made in the app, in the dashboard or in
-- SQL is covered alike, and an e-mail problem can never fail a sign-up or an approval. A job then
-- posts queued rows to the application (/app/api/account-email), which sends them through Resend.
--
-- Nothing is sent until two Vault secrets exist, 'account_email_endpoint' (the route's URL) and
-- 'account_email_secret' (shared with the application). They are created by hand, never committed.
--
-- Security: the HTTP client is the "http" extension, installed inside the private schema, so that
-- anon and authenticated cannot make requests with it. pg_net is deliberately NOT used: it lets
-- every database role queue arbitrary requests, and those grants cannot be revoked by this role.
-- Roles that can read the whole database (postgres and Supabase's own read-all roles, which can
-- already read the Vault) can still reach the schema; that membership cannot be narrowed here.
-- The shared secret is never transmitted; each request carries only an HMAC signature of itself.

create extension if not exists pg_cron;

create schema account_email_private;
revoke all on schema account_email_private from public, anon, authenticated;
-- Fails, rather than being skipped, if "http" is already installed somewhere less protected.
create extension http with schema account_email_private;

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

-- Runs every minute: give up on stale rows, then post what is due. Success means the application
-- answered with the row's id: a redirect to some other page that says "200" does not count.
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
  v_body text;
  v_time text;
  v_status integer;
  v_content text;
  v_error text;
  r record;
begin
  -- Resend remembers an idempotency key for 24 hours; later retries could send twice, and week-old
  -- news is not worth sending.
  update account_email_private.outbox
  set failed_at = now(), last_error = coalesce(last_error, 'expired')
  where sent_at is null and failed_at is null and created_at < now() - interval '24 hours';

  -- Housekeeping: no addresses kept for longer than needed, no ever-growing job log.
  delete from account_email_private.outbox
  where coalesce(sent_at, failed_at) < now() - interval '90 days';
  delete from cron.job_run_details
  where end_time < now() - interval '7 days'
    and jobid in (select jobid from cron.job where jobname = 'account-email-dispatch');

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'account_email_endpoint';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'account_email_secret';
  -- Addresses are only sent encrypted; plain http is accepted for a host on this machine or network
  -- (no dot in its name, or 127.x), as used by tests.
  if v_url is null or v_secret is null
     or v_url !~ '^(https://|http://([a-z0-9-]+|127[.][0-9.]+)(:[0-9]+)?/)' then
    return;
  end if;

  perform account_email_private.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');

  for r in
    select id, kind, email, full_name, attempts from account_email_private.outbox
    where sent_at is null and failed_at is null and next_attempt_at <= now()
    order by seq
    limit 10
    for update skip locked
  loop
    begin
      v_body := jsonb_build_object('id', r.id, 'kind', r.kind, 'email', r.email, 'name', r.full_name)::text;
      v_time := floor(extract(epoch from clock_timestamp()))::bigint::text;
      select status, content into v_status, v_content
      from account_email_private.http((
        'POST',
        v_url,
        array[
          account_email_private.http_header('x-account-email-time', v_time),
          account_email_private.http_header('x-account-email-signature', encode(
            extensions.hmac(convert_to(v_time || '.' || v_body, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'),
            'hex'))
        ],
        'application/json',
        v_body
      )::account_email_private.http_request);

      v_error := case
        when v_status = 200 and position(r.id::text in coalesce(v_content, '')) > 0 then null
        when v_status between 200 and 299 then 'unexpected response'
        else 'HTTP ' || v_status
      end;
    exception when others then
      v_error := left(sqlerrm, 200);
    end;

    -- Five attempts in all, 1, 5, 30 and 120 minutes apart.
    update account_email_private.outbox
    set attempts = r.attempts + 1,
        last_attempt_at = now(),
        sent_at = case when v_error is null then now() end,
        last_error = v_error,
        failed_at = case when v_error is not null and r.attempts + 1 >= 5 then now() end,
        next_attempt_at = now() + (array['1 minute', '5 minutes', '30 minutes', '2 hours'])[least(r.attempts + 1, 4)]::interval
    where id = r.id;
  end loop;
end;
$$;

-- Our functions only: the extension's belong to the platform, and the schema itself keeps them away.
revoke execute on function
  account_email_private.enqueue(text, uuid),
  account_email_private.on_user_confirmed(),
  account_email_private.on_status_change(),
  account_email_private.dispatch()
from public, anon, authenticated;

-- Refuse to finish if the protection this design relies on is not in place.
do $$
begin
  if has_schema_privilege('anon', 'account_email_private', 'usage')
     or has_schema_privilege('authenticated', 'account_email_private', 'usage') then
    raise exception 'API roles must not be able to use account_email_private';
  end if;
  if exists (
    select 1 from pg_depend d
    join pg_extension e on e.oid = d.refobjid and e.extname = 'http'
    join pg_proc p on p.oid = d.objid and d.classid = 'pg_proc'::regclass
    where p.pronamespace <> 'account_email_private'::regnamespace
  ) then
    raise exception 'http functions exist outside account_email_private';
  end if;
end;
$$;

select cron.schedule('account-email-dispatch', '* * * * *', 'select account_email_private.dispatch()');
