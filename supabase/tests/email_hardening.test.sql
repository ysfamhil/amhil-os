begin;

-- Self-service address changes are refused; given-up account e-mails alert the administrator once.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('40000000-0000-4000-8000-000000000001', 'harden@example.test', '{}', now());
delete from account_email_private.outbox where user_id = '40000000-0000-4000-8000-000000000001';

-- Supabase Auth's own role (the grant lets it see the test functions; rolled back with everything else)
grant usage on schema extensions to supabase_auth_admin;
set local role supabase_auth_admin;
select throws_ok($$update auth.users set email_change = 'new@example.test' where id = '40000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the Auth service cannot start an address change');
select throws_ok($$update auth.users set email = 'new@example.test' where id = '40000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the Auth service cannot replace the address');
select lives_ok($$update auth.users set email = email, email_change = '' where id = '40000000-0000-4000-8000-000000000001'$$,
  'writing the same values still works');
select lives_ok($$update auth.users set encrypted_password = 'x', email_confirmed_at = now() where id = '40000000-0000-4000-8000-000000000001'$$,
  'password and confirmation writes are untouched');
reset role;

select lives_ok($$update auth.users set email = 'moved@example.test' where id = '40000000-0000-4000-8000-000000000001'$$,
  'an administrator can change it with SQL');

-- Delivery alerts
insert into account_email_private.outbox (kind, user_id, email) values
  ('account_approved', '40000000-0000-4000-8000-000000000001', 'moved@example.test');
update account_email_private.outbox set attempts = 1, failed_at = null where user_id = '40000000-0000-4000-8000-000000000001';
select is((select count(*) from account_email_private.outbox where kind = 'admin_delivery_failed' and user_id = '40000000-0000-4000-8000-000000000001'),
  0::bigint, 'a retry raises no alert');
update account_email_private.outbox set failed_at = now() where user_id = '40000000-0000-4000-8000-000000000001';
select is((select email || ' ' || full_name from account_email_private.outbox where kind = 'admin_delivery_failed' and user_id = '40000000-0000-4000-8000-000000000001'),
  'moved@example.test account_approved', 'giving up queues one alert naming the message');
update account_email_private.outbox set failed_at = now() + interval '1 second' where user_id = '40000000-0000-4000-8000-000000000001' and kind = 'account_approved';
select is((select count(*) from account_email_private.outbox where kind = 'admin_delivery_failed' and user_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint, 'only once');
update account_email_private.outbox set failed_at = now() where kind = 'admin_delivery_failed' and user_id = '40000000-0000-4000-8000-000000000001';
select is((select count(*) from account_email_private.outbox where kind = 'admin_delivery_failed' and user_id = '40000000-0000-4000-8000-000000000001'),
  1::bigint, 'a failed alert raises no further alert');

select ok(not has_function_privilege('anon', 'public.refuse_self_service_email_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.refuse_self_service_email_change()', 'execute'), 'not callable by API roles');
select ok(not has_schema_privilege('authenticated', 'account_email_private', 'usage'), 'queue stays private');

select * from finish();
rollback;
