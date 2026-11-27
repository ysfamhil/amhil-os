begin;

-- Account e-mails: what gets queued, who may see or send it, and how sending and retrying behave.
-- Everything is rolled back. The only endpoint used is a closed port on this machine, so the
-- successful send is covered by the end-to-end test instead.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(52);

create function pg_temp.queued(user_id text) returns text language sql as $$
  select coalesce(string_agg(kind, ',' order by seq), '') from account_email_private.outbox
  where outbox.user_id = queued.user_id::uuid
$$;
create function pg_temp.set_status(user_id text, value text) returns void language sql as $$
  update public.profiles set status = value where id = user_id::uuid
$$;

-- An administrator, someone who has not confirmed yet, and someone created already confirmed.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('30000000-0000-4000-8000-000000000001', 'mail-admin@example.test', '{}', now()),
  ('30000000-0000-4000-8000-000000000002', 'mail-new@example.test', '{"full_name":"New Person"}', null),
  ('30000000-0000-4000-8000-000000000003', 'mail-direct@example.test', '{}', now());
update public.profiles set status = 'approved', role = 'admin' where id = '30000000-0000-4000-8000-000000000001';
delete from account_email_private.outbox where user_id = '30000000-0000-4000-8000-000000000001';

-- Registration
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), '', 'unconfirmed sign-up: nothing yet');
update auth.users set email_confirmed_at = now() where id = '30000000-0000-4000-8000-000000000002';
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), 'admin_new_registration', 'confirmation: the administrator is told');
update auth.users set email_confirmed_at = null where id = '30000000-0000-4000-8000-000000000002';
update auth.users set email_confirmed_at = now() where id = '30000000-0000-4000-8000-000000000002';
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), 'admin_new_registration', 'told once only');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000003'), 'admin_new_registration', 'created already confirmed: told');
select is((select email || '|' || full_name from account_email_private.outbox where user_id = '30000000-0000-4000-8000-000000000002'),
  'mail-new@example.test|New Person', 'address and name are recorded');
delete from account_email_private.outbox;

-- Access changes, here as the administrator through the API role, as the app does it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","amr":[{"method":"password","timestamp":1}]}', true),
       set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select lives_ok($$select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'approved')$$, 'administrator approves');
reset role;
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), 'account_approved', 'pending -> approved');
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'approved');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), 'account_approved', 'an unchanged status queues nothing');
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'suspended');
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'approved');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000002'), 'account_approved,account_suspended,account_restored', 'suspend, then restore');
select pg_temp.set_status('30000000-0000-4000-8000-000000000003', 'suspended');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000003'), 'account_declined', 'pending -> suspended is a refusal');
select pg_temp.set_status('30000000-0000-4000-8000-000000000003', 'approved');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000003'), 'account_declined,account_approved', 'accepted after a refusal: approved, not "restored"');
select pg_temp.set_status('30000000-0000-4000-8000-000000000003', 'pending');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000003'), 'account_declined,account_approved', 'back to pending queues nothing');
update auth.users set email_confirmed_at = null where id = '30000000-0000-4000-8000-000000000003';
select pg_temp.set_status('30000000-0000-4000-8000-000000000003', 'approved');
select is(pg_temp.queued('30000000-0000-4000-8000-000000000003'), 'account_declined,account_approved', 'nothing is sent to an unconfirmed address');

-- Lockdown: nothing an API caller can be may make a request, read the queue or read the secret.
select ok(not bool_or(has_schema_privilege(r, 'account_email_private', 'usage')),
  'anon, authenticated, authenticator, service_role and the auth service cannot use the private schema')
from unnest(array['anon', 'authenticated', 'authenticator', 'service_role', 'supabase_auth_admin']) r;
select is((select count(*)::int from pg_roles r
           where not r.rolsuper and r.rolname !~ '^pg_' and r.rolname <> 'postgres'
             and has_schema_privilege(r.oid, 'account_email_private', 'usage')
             and not pg_has_role(r.oid, 'pg_read_all_data', 'member')
             and not pg_has_role(r.oid, 'pg_write_all_data', 'member')), 0,
  'otherwise only the owner and roles that already read the whole database can');
select is((select count(*)::int from pg_extension where extname = 'pg_net'), 0, 'pg_net is not installed');
select is((select count(*)::int from pg_depend d
           join pg_extension e on e.oid = d.refobjid and e.extname = 'http'
           join pg_proc p on p.oid = d.objid and d.classid = 'pg_proc'::regclass
           where p.pronamespace <> 'account_email_private'::regnamespace), 0, 'every http function is inside the private schema');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'graphql_public') and p.prosrc ~* 'account_email_private'), 0,
  'no exposed function reaches into the private schema');

create function pg_temp.forbidden() returns setof text language plpgsql as $$
declare
  caller text := current_user;
  attempt record;
begin
  for attempt in select * from (values
    ('make a GET request', 'select account_email_private.http_get(''http://127.0.0.1:9/'')'),
    ('make a POST request', 'select account_email_private.http_post(''http://127.0.0.1:9/'', ''{}'', ''application/json'')'),
    ('make a raw request', 'select account_email_private.http(null::account_email_private.http_request)'),
    ('change the client settings', 'select account_email_private.http_set_curlopt(''CURLOPT_TIMEOUT_MS'', ''1'')'),
    ('run the sender', 'select account_email_private.dispatch()'),
    ('queue a message', 'select account_email_private.enqueue(''account_approved'', null)'),
    ('read the queue', 'select * from account_email_private.outbox'),
    ('read the secret', 'select * from vault.decrypted_secrets'),
    ('schedule a job', 'select cron.schedule(''x'', ''* * * * *'', ''select 1'')')
  ) as a(what, statement)
  loop
    return next throws_ok(attempt.statement, '42501', null, caller || ' cannot ' || attempt.what);
  end loop;
end $$;

set local role anon;
select pg_temp.forbidden();
set local role authenticated;
select pg_temp.forbidden();
reset role;

-- A broken queue must never stop an account change.
alter table account_email_private.outbox rename to outbox_away;
select lives_ok($$select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'suspended')$$, 'status change survives a queue failure');
select is((select status from public.profiles where id = '30000000-0000-4000-8000-000000000002'), 'suspended', 'and is applied');
select lives_ok($$update auth.users set email_confirmed_at = now() where id = '30000000-0000-4000-8000-000000000003'$$, 'confirmation survives a queue failure');
alter table account_email_private.outbox_away rename to outbox;

-- Sending
delete from account_email_private.outbox;
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'approved');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 0, 'nothing is sent before the secrets exist');

-- made up for this run only; no secret is written into the repository
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'account_email_secret');
select vault.create_secret('http://mail.example.com/app/api/account-email', 'account_email_endpoint');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 0, 'never sent unencrypted to a public host');

select vault.update_secret((select id from vault.secrets where name = 'account_email_endpoint'), 'http://127.0.0.1:9/app/api/account-email');
select account_email_private.dispatch();
select is((select concat_ws('|', attempts, sent_at is null, failed_at is null, next_attempt_at > now()) from account_email_private.outbox),
  '1|t|t|t', 'a failed send is recorded and retried later');
select matches((select last_error from account_email_private.outbox), '(?i)connect', 'with the reason');
select ok(not exists (select 1 from account_email_private.outbox o, vault.decrypted_secrets v
                      where v.name = 'account_email_secret' and position(v.decrypted_secret in coalesce(o.last_error, '')) > 0),
  'which never contains the secret');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 1, 'but not at once');
update account_email_private.outbox set next_attempt_at = now();
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 2, 'retried when due');

update account_email_private.outbox set attempts = 4, next_attempt_at = now();
select account_email_private.dispatch();
select ok((select failed_at is not null and attempts = 5 from account_email_private.outbox where kind <> 'admin_delivery_failed'), 'gives up after five attempts');
select is((select count(*)::int from account_email_private.outbox where kind = 'admin_delivery_failed'), 1, 'and queues an alert for the administrator');
delete from account_email_private.outbox where kind = 'admin_delivery_failed';
update account_email_private.outbox set next_attempt_at = now();
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 5, 'and stays given up');

delete from account_email_private.outbox;
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'suspended');
update account_email_private.outbox set created_at = now() - interval '25 hours';
select account_email_private.dispatch();
select is((select last_error || '|' || attempts from account_email_private.outbox where kind <> 'admin_delivery_failed'), 'expired|0', 'stale messages are dropped, not sent late');

-- Deleting the account removes its queued messages.
delete from auth.users where id = '30000000-0000-4000-8000-000000000002';
select is((select count(*)::int from account_email_private.outbox), 0, 'deleted account: nothing left');

select is((select schedule || ' ' || command from cron.job where jobname = 'account-email-dispatch'),
  '* * * * * select account_email_private.dispatch()', 'the sender runs every minute');

select * from finish();
rollback;
