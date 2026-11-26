begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create temporary table workspace_fixtures (
  position integer generated always as identity,
  table_name text primary key,
  insert_row text not null,
  update_column text not null default 'id'
);
grant select on workspace_fixtures to authenticated, service_role;

-- Fixture IDs are derived independently for each owner, so joins can be
-- inserted in dependency order while running as the real authenticated role.
create function pg_temp.fixture_id(table_name text)
returns uuid language sql stable
as $$ select md5(auth.uid()::text || table_name)::uuid $$;

insert into workspace_fixtures (table_name, insert_row) values
  ('clients', '(id, name) values (pg_temp.fixture_id(''clients''), ''Client'')'),
  ('leads', '(id, name) values (pg_temp.fixture_id(''leads''), ''Lead'')'),
  ('crm_leads', '(id, name) values (pg_temp.fixture_id(''crm_leads''), ''CRM'')'),
  ('goals', '(id, title) values (pg_temp.fixture_id(''goals''), ''Goal'')'),
  ('projects', '(id, name) values (pg_temp.fixture_id(''projects''), ''Project'')'),
  ('project_milestones', '(id, project_id, title) values (pg_temp.fixture_id(''project_milestones''), pg_temp.fixture_id(''projects''), ''Milestone'')'),
  ('tasks', '(id, title) values (pg_temp.fixture_id(''tasks''), ''Task'')'),
  ('subtasks', '(id, task_id, title) values (pg_temp.fixture_id(''subtasks''), pg_temp.fixture_id(''tasks''), ''Subtask'')'),
  ('tags', '(id, name) values (pg_temp.fixture_id(''tags''), ''Tag'')'),
  ('learning_areas', '(id, name) values (pg_temp.fixture_id(''learning_areas''), ''Area'')'),
  ('learning_topics', '(id, area_id, name) values (pg_temp.fixture_id(''learning_topics''), pg_temp.fixture_id(''learning_areas''), ''Topic'')'),
  ('learning_sessions', '(id, topic_id, duration_minutes) values (pg_temp.fixture_id(''learning_sessions''), pg_temp.fixture_id(''learning_topics''), 30)'),
  ('habits', '(id, name) values (pg_temp.fixture_id(''habits''), ''Habit'')'),
  ('habit_completions', '(id, habit_id, date) values (pg_temp.fixture_id(''habit_completions''), pg_temp.fixture_id(''habits''), current_date)'),
  ('time_entries', '(id, duration_minutes) values (pg_temp.fixture_id(''time_entries''), 30)'),
  ('income', '(id, amount) values (pg_temp.fixture_id(''income''), 10)'),
  ('expenses', '(id, amount) values (pg_temp.fixture_id(''expenses''), 10)'),
  ('emergency_fund', '(id, name) values (pg_temp.fixture_id(''emergency_fund''), ''Fund'')'),
  ('emergency_fund_transactions', '(id, fund_id, amount) values (pg_temp.fixture_id(''emergency_fund_transactions''), pg_temp.fixture_id(''emergency_fund''), 10)'),
  ('notes', '(id, title) values (pg_temp.fixture_id(''notes''), ''Note'')'),
  ('journal_entries', '(id, story) values (pg_temp.fixture_id(''journal_entries''), ''Journal'')'),
  ('timeline_events', '(id, event_type, title) values (pg_temp.fixture_id(''timeline_events''), ''task_created'', ''Event'')'),
  ('notifications', '(id, type, title, message) values (pg_temp.fixture_id(''notifications''), ''overdue_task'', ''Notification'', ''Message'')');

insert into workspace_fixtures (table_name, insert_row, update_column) values
  ('task_tags', '(task_id, tag_id) values (pg_temp.fixture_id(''tasks''), pg_temp.fixture_id(''tags''))', 'task_id');

select is(
  (select array_agg(tablename::text order by tablename) from pg_policies
   where schemaname = 'public' and policyname = 'workspace: approved account'),
  (select array_agg(table_name order by table_name) from workspace_fixtures),
  'approval policy covers exactly the 24 workspace tables'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = fixture.table_name
      and policyname = 'workspace: approved account' and permissive = 'RESTRICTIVE'
      and cmd = 'ALL' and roles = array['authenticated']::name[]
      and qual like '%is_approved_account()%' and with_check like '%is_approved_account()%'
  ) and (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = fixture.table_name
      and policyname = fixture.table_name || ': owner ' || lower(cmd)
      and permissive = 'PERMISSIVE'
  ) = case when fixture.table_name = 'task_tags' then 3 else 4 end,
  fixture.table_name || ': restrictive approval and original owner policies'
)
from workspace_fixtures fixture order by position;

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'phase1-admin@example.test', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'phase1-member@example.test', '{"role":"admin","status":"approved"}'),
  ('10000000-0000-4000-8000-000000000003', 'phase1-other@example.test', '{}'),
  ('10000000-0000-4000-8000-000000000004', 'phase1-deleted@example.test', '{}');

select is(
  (select count(*) from public.profiles where email like 'phase1-%@example.test'
   and role = 'user' and status = 'pending'),
  4::bigint, 'trusted signup creates pending ordinary profiles'
);

delete from auth.users where id = '10000000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  0::bigint, 'trusted Auth deletion cascades to the profile'
);

update public.profiles set role = 'admin', status = 'approved', approved_at = now()
where id = '10000000-0000-4000-8000-000000000001';

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select is((select count(*) from public.profiles where email like 'phase1-%@example.test'),
  3::bigint, 'approved admin can list profiles without RLS recursion');

select lives_ok($sql$
  update public.profiles set status = 'approved', approved_at = now(), approved_by = auth.uid()
  where id in ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003')
$sql$, 'approved admin can approve other accounts');
select is((select count(*) from public.profiles where approved_by = auth.uid() and status = 'approved'),
  2::bigint, 'approval and approval metadata persisted');
select throws_ok($sql$ update public.profiles set status = 'suspended' where id = auth.uid() $sql$,
  '42501', null, 'admin cannot change own access status');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000003';
select lives_ok(format('insert into public.%I %s', table_name, insert_row), table_name || ': other owner can insert')
from workspace_fixtures order by position;

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select throws_ok($sql$ insert into public.profiles (id) values (auth.uid()) $sql$,
  '42501', null, 'authenticated profile insert denied by permissions');
select throws_ok($sql$ delete from public.profiles where id = auth.uid() $sql$,
  '42501', null, 'authenticated profile delete denied by permissions');

select throws_ok(format('update public.profiles set %s where id = auth.uid()', assignment),
  '42501', null, 'ordinary user cannot write ' || assignment)
from (values
  ('role = ''admin'''),
  ('status = ''suspended'''),
  ('approved_at = null'),
  ('approved_by = null'),
  ('email = ''changed@example.test'''),
  ('id = ''10000000-0000-4000-8000-000000000004'''),
  ('created_at = created_at - interval ''1 day'''),
  ('updated_at = updated_at - interval ''1 day''')
) fields(assignment);

select lives_ok($sql$
  update public.profiles set full_name = 'Updated name', avatar_url = 'https://example.test/avatar'
  where id = auth.uid()
$sql$, 'ordinary user can edit profile display fields');
select is((select full_name from public.profiles where id = auth.uid()), 'Updated name', 'profile edit persisted');
select is((select count(*) from public.profiles where email like 'phase1-%@example.test'),
  1::bigint, 'ordinary user can only read their own profile');

select lives_ok(format('insert into public.%I %s', table_name, insert_row), table_name || ': approved owner can insert')
from workspace_fixtures order by position;
select results_eq(format('select count(*) from public.%I', table_name), 'values (1::bigint)',
  table_name || ': approved owner sees own fixture, other owner stays hidden')
from workspace_fixtures order by position;
select results_eq(
  format('with changed as (update public.%1$I set %2$I = %2$I returning 1) select count(*) from changed',
    table_name, update_column),
  format('values (%s::bigint)', case when table_name = 'task_tags' then 0 else 1 end),
  table_name || ': existing owner update scope is preserved')
from workspace_fixtures order by position;

-- Run the same direct database checks for each blocked status, retaining the
-- same member ID so records created before suspension remain in the database.
create function pg_temp.check_blocked_workspace(account_status text)
returns setof text language plpgsql
as $$
declare
  fixture record;
  expected_empty constant text := 'values (0::bigint)';
  label text;
begin
  for fixture in select * from workspace_fixtures order by position loop
    label := fixture.table_name || ': ' || account_status;
    return next results_eq(format('select count(*) from public.%I', fixture.table_name),
      expected_empty, label || ' read blocked');
    return next results_eq(
      format('with changed as (update public.%1$I set %2$I = %2$I returning 1) select count(*) from changed',
        fixture.table_name, fixture.update_column),
      expected_empty, label || ' update blocked');
    return next results_eq(
      format('with removed as (delete from public.%I returning 1) select count(*) from removed', fixture.table_name),
      expected_empty, label || ' delete blocked');
    return next throws_ok(format('insert into public.%I %s', fixture.table_name, fixture.insert_row),
      '42501', null, label || ' insert blocked');
  end loop;
end;
$$;

reset role;
update public.profiles set status = 'pending', approved_at = null, approved_by = null
where id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select status from public.profiles where id = auth.uid()), 'pending', 'pending member can read own status');
select * from pg_temp.check_blocked_workspace('pending');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
update public.profiles set status = 'suspended', approved_at = null, approved_by = null
where id = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select is((select status from public.profiles where id = auth.uid()), 'suspended', 'admin suspension persisted and member can still read status');
select * from pg_temp.check_blocked_workspace('suspended');

set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
update public.profiles set status = 'approved', approved_at = now(), approved_by = auth.uid()
where id = '10000000-0000-4000-8000-000000000002';
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select is((select count(*) from public.tasks), 1::bigint, 'reinstatement restores access for the same member');

reset role;
update public.profiles set status = 'suspended' where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select is((select count(*) from public.profiles where email like 'phase1-%@example.test'),
  1::bigint, 'suspended admin loses global profile read');
select results_eq($sql$
  with changed as (
    update public.profiles set status = 'suspended'
    where id = '10000000-0000-4000-8000-000000000002' returning 1
  ) select count(*) from changed
$sql$, 'values (0::bigint)', 'suspended admin cannot change other accounts');

reset role;
set local role service_role;
select results_eq(format('select count(*) from public.%I', table_name), 'values (2::bigint)',
  table_name || ': service role retains access across owners')
from workspace_fixtures order by position;
select results_eq($sql$
  with changed as (update public.notifications set is_read = true returning 1)
  select count(*) from changed
$sql$, 'values (2::bigint)', 'trusted service role can update workspace rows across owners');
select lives_ok($sql$
  update public.profiles set status = 'approved' where id = '10000000-0000-4000-8000-000000000001'
$sql$, 'trusted service role can maintain profiles');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000002';
select results_eq(
  format('with removed as (delete from public.%I returning 1) select count(*) from removed', table_name),
  'values (1::bigint)', table_name || ': approved owner can delete only their fixture')
from workspace_fixtures order by position desc;

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
select is((select count(*) from public.profiles where email like 'phase1-%@example.test'),
  0::bigint, 'anonymous caller cannot read profiles');
select throws_ok($sql$ insert into public.profiles (id) values (gen_random_uuid()) $sql$,
  '42501', null, 'anonymous profile insert denied');
select throws_ok($sql$ delete from public.profiles $sql$,
  '42501', null, 'anonymous profile delete denied');

reset role;
select * from finish();
rollback;
