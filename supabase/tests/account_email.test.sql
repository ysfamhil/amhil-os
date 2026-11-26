begin;

-- Account e-mails: what gets queued, who may see it, and how sending and retrying behave.
-- Everything is rolled back, so the requests queued here are never made.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(33);

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
select throws_ok($$select * from account_email_private.outbox$$, '42501', null, 'the queue is not readable through the API role');
select throws_ok($$select account_email_private.dispatch()$$, '42501', null, 'nor can the API role run the sender');
select throws_ok($$select account_email_private.enqueue('account_approved', '30000000-0000-4000-8000-000000000002')$$, '42501', null, 'nor queue a message');
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

select vault.create_secret('http://127.0.0.1:9/app/api/account-email', 'account_email_endpoint');
-- made up for this run only; no secret is written into the repository
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'account_email_secret');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 1, 'sent once configured');
select is((select count(*)::int from net.http_request_queue q join account_email_private.outbox o on o.request_id = q.id
           where q.method = 'POST' and q.headers ->> 'x-account-email-secret' = (select decrypted_secret from vault.decrypted_secrets where name = 'account_email_secret')
             and (convert_from(q.body, 'utf8')::jsonb) = jsonb_build_object('id', o.id, 'kind', o.kind, 'email', o.email, 'name', o.full_name)),
  1, 'the request carries the secret, the row id, kind and address');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 1, 'not sent again while in flight');

insert into net._http_response (id, status_code, timed_out) select request_id, 502, false from account_email_private.outbox;
select account_email_private.dispatch();
select is((select concat_ws('|', last_error, request_id is null, sent_at is null, failed_at is null, next_attempt_at > now()) from account_email_private.outbox),
  'HTTP 502|t|t|t|t', 'a failure is recorded and retried later');
select is((select attempts from account_email_private.outbox), 1, 'but not at once');

update account_email_private.outbox set next_attempt_at = now();
delete from net._http_response;
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 2, 'retried when due');
update account_email_private.outbox set last_attempt_at = now() - interval '3 minutes';
select account_email_private.dispatch();
select is((select last_error || '|' || (request_id is null) from account_email_private.outbox), 'no response|true', 'a lost request is retried');

update account_email_private.outbox set next_attempt_at = now();
select account_email_private.dispatch();
insert into net._http_response (id, status_code, timed_out) select request_id, 204, false from account_email_private.outbox;
select account_email_private.dispatch();
select ok((select sent_at is not null and last_error is null from account_email_private.outbox), 'success marks the row sent');
select account_email_private.dispatch();
select is((select attempts from account_email_private.outbox), 3, 'and it is never sent again');

update account_email_private.outbox set sent_at = null, attempts = 4, next_attempt_at = now();
delete from net._http_response;
select account_email_private.dispatch();
insert into net._http_response (id, status_code, timed_out) select request_id, 500, false from account_email_private.outbox;
select account_email_private.dispatch();
select ok((select failed_at is not null and attempts = 5 from account_email_private.outbox), 'gives up after five attempts');

delete from account_email_private.outbox;
select pg_temp.set_status('30000000-0000-4000-8000-000000000002', 'suspended');
update account_email_private.outbox set created_at = now() - interval '25 hours';
select account_email_private.dispatch();
select is((select last_error || '|' || attempts from account_email_private.outbox), 'expired|0', 'stale messages are dropped, not sent late');

-- Deleting the account removes its queued messages.
delete from auth.users where id = '30000000-0000-4000-8000-000000000002';
select is((select count(*)::int from account_email_private.outbox), 0, 'deleted account: nothing left');

select is((select schedule || ' ' || command from cron.job where jobname = 'account-email-dispatch'),
  '* * * * * select account_email_private.dispatch()', 'the sender runs every minute');

select * from finish();
rollback;
