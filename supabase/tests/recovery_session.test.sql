begin;

-- A session from an e-mail link (amr without "password") must reach nothing but its own profile row.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001', 'recovery-admin@example.test', '{}'),
  ('20000000-0000-4000-8000-000000000002', 'recovery-member@example.test', '{}');
update public.profiles set status = 'approved', role = 'admin' where id = '20000000-0000-4000-8000-000000000001';
update public.profiles set status = 'approved' where id = '20000000-0000-4000-8000-000000000002';
insert into public.notes (user_id, title) values
  ('20000000-0000-4000-8000-000000000001', 'Admin note'),
  ('20000000-0000-4000-8000-000000000002', 'Member note');

create function pg_temp.sign_in(user_id text, method text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', user_id, 'role', 'authenticated',
    'amr', case when method is not null then jsonb_build_array(jsonb_build_object('method', method, 'timestamp', 1)) end
  ))::text, true),
  set_config('request.jwt.claim.sub', user_id, true)
$$;

set local role authenticated;

-- Password sessions keep working.
select pg_temp.sign_in('20000000-0000-4000-8000-000000000002', 'password');
select ok(public.is_approved_account(), 'password session: approved account');
select is((select count(*) from public.notes), 1::bigint, 'password session: reads own notes');
select lives_ok($$insert into public.notes (title) values ('Second')$$, 'password session: writes');
select lives_ok($$select public.export_workspace_backup()$$, 'password session: exports');

-- Recovery and confirmation links.
select pg_temp.sign_in('20000000-0000-4000-8000-000000000002', 'otp');
select ok(not public.is_approved_account(), 'otp session: not an approved account');
select is((select count(*) from public.notes), 0::bigint, 'otp session: reads no notes');
select throws_ok($$insert into public.notes (title) values ('Sneaky')$$, '42501', null, 'otp session: cannot insert');
select is_empty($$update public.notes set title = 'x' returning id$$, 'otp session: cannot update');
select is_empty($$delete from public.notes returning id$$, 'otp session: cannot delete');
select throws_ok($$select public.export_workspace_backup()$$, null, null, 'otp session: cannot export');
select throws_ok($$select public.export_workspace_backup_text()$$, null, null, 'otp session: cannot export text');
select throws_ok($$select public.reset_workspace_data()$$, null, null, 'otp session: cannot reset the workspace');
select throws_ok($$select public.restore_workspace_backup('{}'::jsonb)$$, null, null, 'otp session: cannot restore');
select is((select count(*) from public.profiles), 1::bigint, 'otp session: sees only its own profile');
select is_empty($$update public.profiles set full_name = 'x' returning id$$, 'otp session: cannot edit the profile');

select pg_temp.sign_in('20000000-0000-4000-8000-000000000002', 'recovery');
select is((select count(*) from public.notes), 0::bigint, 'recovery (PKCE link) session: reads no notes');

-- An administrator's e-mail link gives no administrator powers.
select pg_temp.sign_in('20000000-0000-4000-8000-000000000001', 'otp');
select ok(not public.is_admin(), 'admin otp session: not an administrator');
select is((select count(*) from public.profiles), 1::bigint, 'admin otp session: cannot list accounts');
select is_empty(
  $$update public.profiles set status = 'suspended' where id = '20000000-0000-4000-8000-000000000002' returning id$$,
  'admin otp session: cannot change another account'
);
select is((select count(*) from public.notes), 0::bigint, 'admin otp session: reads no notes');

select pg_temp.sign_in('20000000-0000-4000-8000-000000000001', 'password');
select ok(public.is_admin(), 'admin password session: administrator');
select ok((select count(*) from public.profiles) >= 2, 'admin password session: lists accounts');

-- Tokens without the claim (not from Supabase Auth) behave as before.
select pg_temp.sign_in('20000000-0000-4000-8000-000000000002', null);
select ok(public.is_approved_account(), 'no amr claim: unchanged');

reset role;
select is((select count(*) from public.notes where title in ('Admin note', 'Member note', 'Second')), 3::bigint, 'no data was changed by restricted sessions');

select * from finish();
rollback;
