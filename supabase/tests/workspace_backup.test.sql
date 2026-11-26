begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is(
  workspace_backup_private.clean_note(
    '<div>&lt;strong&gt;literal&lt;/strong&gt; &amp; &quot; &#60; <strong>format</strong><img alt="<b>">'
    || '<script>alert(1)</script></div>'),
  '<div>&lt;strong&gt;literal&lt;/strong&gt; &amp; &quot; &#60; <strong>format</strong>&lt;img alt="&lt;b&gt;"&gt;'
    || '&lt;script&gt;alert(1)&lt;/script&gt;</div>',
  'sanitizer retains escaped tags and entities, permits real formatting, and escapes unsafe markup'
);
select is(
  workspace_backup_private.clean_note(workspace_backup_private.clean_note('&lt;b&gt; <b>format</b><img src=x>')),
  '&lt;b&gt; <b>format</b>&lt;img src=x&gt;',
  'sanitizer is idempotent'
);

create temporary table workspace_fixtures (
  position integer generated always as identity,
  table_name text primary key,
  insert_row text not null,
  update_column text not null default 'id'
);
grant select on workspace_fixtures to authenticated;

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

create temporary table backups (name text primary key, payload jsonb);
grant select, insert, update on backups to authenticated;

create temporary table hard_links as select * from workspace_backup_private.relationships();
grant select on hard_links to authenticated;

insert into auth.users (id, email) values
  ('20000000-0000-4000-8000-000000000001', 'backup-first@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'backup-other@example.test'),
  ('20000000-0000-4000-8000-000000000003', 'backup-pending@example.test');
update public.profiles set status = 'approved' where email in ('backup-first@example.test', 'backup-other@example.test');

select is(
  (select array_agg(table_name order by table_name) from workspace_backup_private.inventory()),
  (select array_agg(tablename::text order by tablename) from pg_policies
    where schemaname = 'public' and policyname = 'workspace: approved account'),
  'backup inventory covers every Phase 1 workspace table'
);
select is(
  (select array_agg(child || '.' || field || ' → ' || parent order by child, field, parent)
    from workspace_backup_private.relationships()),
  (select array_agg(child.relname || '.' || field.attname || ' → ' || parent.relname
    order by child.relname, field.attname, parent.relname) from pg_constraint c
    join pg_class parent on parent.oid = c.confrelid
    join pg_class child on child.oid = c.conrelid
    join pg_attribute field on field.attrelid = child.oid and field.attnum = any(c.conkey)
    where c.contype = 'f' and field.attname <> 'user_id'
      and parent.relnamespace = 'public'::regnamespace and child.relnamespace = 'public'::regnamespace
      and parent.relname in (select table_name from workspace_backup_private.inventory())
      and child.relname in (select table_name from workspace_backup_private.inventory())),
  'every live workspace foreign key matches an explicit relationship'
);
select ok(not exists (
  select 1 from workspace_backup_private.inventory() item
  where (select array_agg(column_name::text order by column_name)
    from information_schema.columns where table_schema = 'public' and table_name = item.table_name)
    is distinct from (select array_agg(name order by name) from unnest(item.columns) as cols(name))
), 'inventory fields match all 24 live tables');

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000003';
select throws_ok('select public.export_workspace_backup()', '42501', 'An approved account is required', 'pending backup denied');
select throws_ok('select public.preview_workspace_restore(''{}'')', '42501', 'An approved account is required', 'pending preview denied');
select throws_ok('select public.restore_workspace_backup(''{}'')', '42501', 'An approved account is required', 'pending restore denied');
select throws_ok('select public.reset_workspace_data()', '42501', 'An approved account is required', 'pending reset denied');

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
select lives_ok(format('insert into public.%I %s', table_name, insert_row), table_name || ': other owner fixture')
from workspace_fixtures order by position;
insert into backups values ('other', public.export_workspace_backup());

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
select lives_ok(format('insert into public.%I %s', table_name, insert_row), table_name || ': owner fixture')
from workspace_fixtures order by position;
insert into public.tasks (title)
select 'Large fixture ' || sequence from generate_series(1, 1004) as rows(sequence);
update public.notes set content = '<strong>Safe</strong><img src=x onerror=alert(1)><script>alert(1)</script>',
  task_id = pg_temp.fixture_id('tasks'), tags = array['first', null, 'third']
where id = pg_temp.fixture_id('notes');
insert into public.notes (title, tags)
values ('Multidimensional tags', array[array['first', null], array[null, 'last']]);
insert into public.timeline_events (event_type, title, metadata) values
  ('task_created', 'JSON null', 'null'),
  ('task_created', 'JSON boolean', 'true'),
  ('task_created', 'JSON string', '"a string"'),
  ('task_created', 'JSON number', '9007199254740993'),
  ('task_created', 'JSON array', '[null, false, 0.12345678901234567890123456789, {"key":"value"}]'),
  ('task_created', 'JSON object', '{"area_id":"ordinary metadata","big":1234567890123456789012345678901234567890}');
update public.timeline_events set related_entity_type = 'learning_topic',
  related_entity_id = pg_temp.fixture_id('learning_topics'),
  metadata = jsonb_build_object('area_id', pg_temp.fixture_id('learning_areas'))
where id = pg_temp.fixture_id('timeline_events');
update public.notifications set related_entity_type = 'task', related_entity_id = pg_temp.fixture_id('tasks')
where id = pg_temp.fixture_id('notifications');

insert into backups values ('original', public.export_workspace_backup());
update public.notes set tags = '[0:1]={x,NULL}'::text[] where id = pg_temp.fixture_id('notes');
select throws_ok('select public.export_workspace_backup()', '22023',
  'Cannot back up notes with nonstandard tag array bounds', 'unrepresentable tag bounds reject export');
update public.notes set tags = array['first', null, 'third'] where id = pg_temp.fixture_id('notes');
select is((select payload->>'schema' from backups where name = 'original'), 'amhil.workspace', 'schema marker');
select is((select payload->>'version' from backups where name = 'original'), '2', 'version marker');
select is((select jsonb_array_length(payload->'data'->'tasks') from backups where name = 'original'), 1005, 'large backup exceeds API row limit');
select ok((select not (payload->'data'->'tasks'->0 ? 'user_id') and not (payload->'data' ? 'profiles')
  from backups where name = 'original'), 'backup excludes identity and ownership columns');
select is((select public.preview_workspace_restore(payload)->>'empty' from backups where name = 'original'),
  'false', 'preview describes non-empty workspace');
select throws_ok($$ select public.restore_workspace_backup(payload) from backups where name = 'original' $$,
  '22023', 'Restore requires an empty workspace', 'non-empty restore rejected');
select is((select public.export_workspace_backup()->'data'), (select payload->'data' from backups where name = 'original'),
  'rejected restore changed no existing rows');

-- Exercise each relation through normal authenticated writes.
set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
select throws_ok(
  format('update public.%I set %I = %L%s', child, field,
    md5('20000000-0000-4000-8000-000000000001' || parent)::uuid,
    case when child = 'habit_completions' then ', date = date + 1' else '' end),
  '23503', null, child || '.' || field || ': cross-owner update denied')
from hard_links where child <> 'task_tags' order by child, field;
select throws_ok($sql$
  insert into public.subtasks (task_id, title)
  values (md5('20000000-0000-4000-8000-000000000001tasks')::uuid, 'Invalid foreign task')
$sql$, '23503', null, 'cross-owner direct insert denied');
select throws_ok($sql$
  insert into public.task_tags (task_id, tag_id)
  values (pg_temp.fixture_id('tasks'), md5('20000000-0000-4000-8000-000000000001tags')::uuid)
$sql$, '23503', 'Task and tag must have the same workspace owner', 'cannot link own task to foreign tag');
select throws_ok($sql$
  insert into public.task_tags (task_id, tag_id)
  values (md5('20000000-0000-4000-8000-000000000001tasks')::uuid, pg_temp.fixture_id('tags'))
$sql$, '42501', null, 'cannot link foreign task to own tag');
select is(public.export_workspace_backup()->'data', (select payload->'data' from backups where name = 'other'),
  'rejected cross-owner writes cannot poison a backup');

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
insert into public.tasks (id, title) values (pg_temp.fixture_id('delete-task'), 'Cascade fixture');
insert into public.subtasks (task_id, title) values (pg_temp.fixture_id('delete-task'), 'Cascade fixture');
insert into public.task_tags (task_id, tag_id) values (pg_temp.fixture_id('delete-task'), pg_temp.fixture_id('tags'));
update public.time_entries set task_id = pg_temp.fixture_id('delete-task');
delete from public.tasks where id = pg_temp.fixture_id('delete-task');
select is((select count(*) from public.subtasks where title = 'Cascade fixture'), 0::bigint,
  'ordinary task delete still cascades within the same owner');
select is((select count(*) from public.task_tags), 1::bigint, 'ordinary task delete cascades its task-tag pair');
select ok((select task_id is null and user_id = auth.uid() from public.time_entries),
  'SET NULL removes the task reference and preserves the owner');

-- SET NULL touches the time entry timestamp. Use a new baseline for rollback checks.
update backups set payload = public.export_workspace_backup() where name = 'original';
set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
select is(public.export_workspace_backup()->'data', (select payload->'data' from backups where name = 'other'),
  'ordinary delete in another account changes no records');
set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';

reset role;
create function pg_temp.reject_write() returns trigger language plpgsql as $$
begin
  raise exception 'Injected write failure';
end;
$$;
create trigger backup_test_fail_delete before delete on public.clients
for each row execute function pg_temp.reject_write();
set local role authenticated;
select throws_ok('select public.reset_workspace_data()', 'P0001', 'Injected write failure', 'late reset failure surfaces');
select is((select public.export_workspace_backup()->'data'), (select payload->'data' from backups where name = 'original'),
  'late reset failure rolled back every deletion');

reset role;
drop trigger backup_test_fail_delete on public.clients;
set local role authenticated;
select is(public.reset_workspace_data(), (select payload->'counts' from backups where name = 'original'),
  'reset deletion counts equal original counts for all tables');
select is((select status from public.profiles where id = auth.uid()), 'approved', 'reset preserves profile');
select is((select sum(value::int) from jsonb_each_text(public.export_workspace_backup()->'counts')),
  0::bigint, 'all workspace data deleted');
select is((select public.preview_workspace_restore(payload)->>'empty' from backups where name = 'original'),
  'true', 'preview confirms empty workspace');

select throws_ok($$ select public.preview_workspace_restore('{"app":"AMHIL OS","version":99,"data":{}}') $$,
  '22023', 'Unsupported backup version', 'unsupported version rejected');
select throws_ok($$ select public.restore_workspace_backup('{"app":"AMHIL OS","version":1,"data":{"tasks":[null]}}') $$,
  '22023', 'Invalid record in tasks', 'malformed row rejected');
select throws_ok($$ select public.restore_workspace_backup('{"app":"AMHIL OS","version":1,"data":{"unknown":[]}}') $$,
  '22023', 'Unsupported table in backup', 'unknown table rejected');
select throws_ok($$ select public.restore_workspace_backup('{"app":"AMHIL OS","version":1,"data":{"tasks":[{"extra":"no"}]}}') $$,
  '22023', 'Unsupported field in tasks', 'unknown field rejected');
select throws_ok($$ select public.restore_workspace_backup(jsonb_set(payload, '{counts,tasks}', '1')) from backups where name = 'original' $$,
  '22023', 'Backup counts do not match the data', 'tampered counts rejected');
select throws_ok($$ select public.restore_workspace_backup(jsonb_set(payload, '{data,subtasks,0,task_id}', to_jsonb(gen_random_uuid())))
  from backups where name = 'original' $$,
  '22023', 'Unrestorable relationship subtasks.task_id', 'dangling hard relationship rejected');
select throws_ok($$ select public.preview_workspace_restore(jsonb_build_object('oversize', repeat('x', 3145728))) $$,
  '22023', 'Backup exceeds the supported size limit (3 MiB)', 'direct RPC size limit enforced');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"timeline_events":[{"id":"'
    || gen_random_uuid() || '","event_type":"task_created","title":"Over limit","metadata":['
    || repeat('1e100000,', 32) || '0]}]}}')
$sql$, '22023', 'Backup exceeds the supported size limit (3 MiB)', 'compact numeric expansion cannot exceed the backup limit');

reset role;
create trigger backup_test_fail_insert before insert on public.task_tags
for each row execute function pg_temp.reject_write();
set local role authenticated;
select throws_ok($$ select public.restore_workspace_backup(payload) from backups where name = 'original' $$,
  'P0001', 'Injected write failure', 'late restore failure surfaces');
select is((select sum(value::int) from jsonb_each_text(public.export_workspace_backup()->'counts')),
  0::bigint, 'late restore failure rolled back every insert');

reset role;
drop trigger backup_test_fail_insert on public.task_tags;
set local role authenticated;
select is((select public.restore_workspace_backup(payload) from backups where name = 'original'),
  (select payload->'counts' from backups where name = 'original'), 'full restore wrote the expected counts');
select is(public.export_workspace_backup()->'counts', (select payload->'counts' from backups where name = 'original'),
  'restored counts round trip for all 24 tables');
select is((select count(*) from public.tasks where id = pg_temp.fixture_id('tasks')), 0::bigint, 'record IDs remapped');
select is((select count(*) from public.task_tags link join public.tasks t on t.id = link.task_id
  join public.tags tag on tag.id = link.tag_id where t.title = 'Task' and tag.name = 'Tag'),
  1::bigint, 'both task-tag keys remapped');
select is((select count(*) from public.notes note join public.tasks task on task.id = note.task_id where task.title = 'Task'),
  1::bigint, 'note task reference remapped');
select ok((select content like '<strong>Safe</strong>%' and content not like '%<img%' and content not like '%<script%' from public.notes where title = 'Note'),
  'safe note formatting retained and untrusted markup escaped');
select is((select count(*) from public.timeline_events event join public.learning_topics topic on topic.id = event.related_entity_id
  join public.learning_areas area on area.id = (event.metadata->>'area_id')::uuid and area.id = topic.area_id),
  1::bigint, 'timeline topic and nested area references remapped');
select is((select count(*) from public.notifications notification join public.tasks task on task.id = notification.related_entity_id
  where task.title = 'Task'), 1::bigint, 'notification target remapped');
select is((select count(*) from public.emergency_fund_transactions txn join public.emergency_fund fund on fund.id = txn.fund_id),
  1::bigint, 'fund transaction reference remapped');
select is((select tags from public.notes where title = 'Note'), array['first', null, 'third'],
  'version 2 restores null array element');
select is((select tags from public.notes where title = 'Multidimensional tags'),
  array[array['first', null], array[null, 'last']], 'version 2 restores multidimensional tags');
select is(
  (select jsonb_object_agg(title, metadata) from public.timeline_events where title like 'JSON %'),
  (select jsonb_object_agg(event->>'title', event->'metadata')
   from backups, jsonb_array_elements(payload->'data'->'timeline_events') as source(event)
   where name = 'original' and event->>'title' like 'JSON %'),
  'version 2 restores every JSON metadata type exactly');
select ok((select metadata is not null and metadata = 'null'::jsonb
  from public.timeline_events where title = 'JSON null'), 'JSON null remains distinct from SQL NULL');
select throws_ok($$ select public.restore_workspace_backup(payload) from backups where name = 'original' $$,
  '22023', 'Restore requires an empty workspace', 'repeat restore rejected');

insert into backups
select 'legacy', jsonb_build_object('app', 'AMHIL OS', 'version', 1, 'exportedAt', payload->'exportedAt',
  'data', ((payload->'data') - array['journal_entries','emergency_fund','emergency_fund_transactions','crm_leads'])
    || jsonb_build_object(
      'profiles', jsonb_build_array(jsonb_build_object('role','admin')),
      'task_tags', jsonb_build_array((payload->'data'->'task_tags'->0) || '{"tasks":{"user_id":"ignored"}}'),
      'tasks', jsonb_build_array(jsonb_build_object(
        'id', pg_temp.fixture_id('tasks'), 'title', 'Legacy task',
        'user_id', '20000000-0000-4000-8000-000000000002'
      ))
    ))
from backups where name = 'original';
select public.reset_workspace_data();
select is((select jsonb_array_length(public.preview_workspace_restore(payload)->'omitted')
  from backups where name = 'legacy'), 4, 'legacy preview identifies omitted tables');
select lives_ok($$ select public.restore_workspace_backup(payload) from backups where name = 'legacy' $$,
  'version 1 backup restored');
select is((select user_id from public.tasks where title = 'Legacy task'), auth.uid(),
  'legacy ownership taken from session');
select is((select count(*) from public.task_tags), 1::bigint, 'legacy join link restored');
select is((select role from public.profiles where id = auth.uid()), 'user', 'legacy profile header ignored');
select is((select tags from public.notes where title = 'Note'), array['first', null, 'third'],
  'version 1 restores legacy null array element');
select is(
  (select jsonb_object_agg(title, metadata) from public.timeline_events where title like 'JSON %'),
  (select jsonb_object_agg(event->>'title', event->'metadata')
   from backups, jsonb_array_elements(payload->'data'->'timeline_events') as source(event)
   where name = 'legacy' and event->>'title' like 'JSON %'),
  'version 1 restores every legacy JSON metadata type exactly');

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
select is(public.export_workspace_backup()->'data', (select payload->'data' from backups where name = 'other'),
  'other workspace record contents survive first account reset and restore');
reset role;
select is((select count(*) from auth.users where email like 'backup-%@example.test'), 3::bigint,
  'auth accounts untouched');

set local role authenticated;
set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000001';
select throws_ok($sql$
  select public.restore_workspace_backup_text('{"app":"AMHIL OS","version":1,"data":{"income":[{"id":"'
    || gen_random_uuid() || '","amount":1.235}]}}')
$sql$, '22023', 'Numeric value does not fit income.amount without precision loss',
  'numeric(12,2) rejects fractional rounding even when the workspace contains data');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"income":[{"id":"'
    || gen_random_uuid() || '","amount":10000000000}]}}')
$sql$, '22023', 'Numeric value does not fit income.amount without precision loss',
  'numeric(12,2) rejects integer overflow before casting');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"goals":[{"id":"'
    || gen_random_uuid() || '","title":"Precision goal","progress":1.235}]}}')
$sql$, '22023', 'Numeric value does not fit goals.progress without precision loss',
  'numeric(5,2) rejects fractional rounding');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"learning_topics":[{"id":"'
    || gen_random_uuid() || '","area_id":"' || gen_random_uuid() || '","name":"Precision topic","confidence":1.23}]}}')
$sql$, '22023', 'Numeric value does not fit learning_topics.confidence without precision loss',
  'numeric(3,1) rejects fractional rounding');
select lives_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"income":[{"id":"'
    || gen_random_uuid() || '","amount":1.23000}]}}')
$sql$, 'numeric(12,2) accepts additional trailing zeroes without precision loss');

select public.reset_workspace_data();
insert into public.notes (title, content) values (
  'Boundary note', '<p>&lt;b&gt; <b>real</b> &amp; <img src=x></p>' || repeat('<', 780000)
);
insert into backups values ('boundary', public.export_workspace_backup());
select public.reset_workspace_data();
select is((select public.preview_workspace_restore(payload)->'counts'->>'notes'
  from backups where name = 'boundary'), '1', 'preview accepts a sanitized backup just below the limit');
select is((select public.restore_workspace_backup(payload)->>'notes' from backups where name = 'boundary'),
  '1', 'restore accepts a sanitized backup just below the limit');
insert into backups values ('boundary again', public.export_workspace_backup());
select ok((select octet_length(payload::text) between 3100000 and 3145728
  from backups where name = 'boundary again'), 're-export remains just below 3 MiB after sanitation expansion');
select ok((select content like '<p>&lt;b&gt; <b>real</b> &amp; &lt;img src=x&gt;</p>&lt;%' from public.notes),
  'restore preserves literal and actual tags correctly at the size boundary');
select public.reset_workspace_data();
select is((select public.restore_workspace_backup(payload)->>'notes' from backups where name = 'boundary again'),
  '1', 'the re-export restores a second time');
select is((select content from public.notes), (select payload#>>'{data,notes,0,content}'
  from backups where name = 'boundary again'), 'repeated restore preserves sanitized note exactly');

select public.reset_workspace_data();
insert into public.notes (title, content) values ('Too large after escaping', repeat('<', 800000));
select throws_ok('select public.export_workspace_backup()', '22023',
  'The workspace would exceed the 3 MiB backup limit after restore',
  'export preflight rejects a raw backup that cannot stay exportable after restore');
select is((select length(content) from public.notes), 800000, 'failed export did not change the stored note');
select public.reset_workspace_data();
insert into backups
select 'expands too far', jsonb_build_object('app', 'AMHIL OS', 'version', 1, 'data',
  jsonb_build_object('notes', jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(), 'title', 'Oversize on restore', 'content', repeat('<', 800000)
  ))));
select throws_ok($sql$ select public.preview_workspace_restore(payload) from backups where name = 'expands too far' $sql$,
  '22023', 'The workspace would exceed the 3 MiB backup limit after restore', 'preview rejects expansion beyond 3 MiB');
select throws_ok($sql$ select public.restore_workspace_backup(payload) from backups where name = 'expands too far' $sql$,
  '22023', 'The workspace would exceed the 3 MiB backup limit after restore', 'restore rejects expansion beyond 3 MiB');
select is((select sum(value::int) from jsonb_each_text(public.export_workspace_backup()->'counts')),
  0::bigint, 'failed size validation leaves all 24 tables empty');

select throws_ok($sql$
  select public.restore_workspace_backup_text('{"app":"AMHIL OS","version":1,"data":{"time_entries":[{"id":"'
    || gen_random_uuid() || '","duration_minutes":30.5}]}}')
$sql$, '22023', 'Integer value does not fit time_entries.duration_minutes without precision loss',
  'restore rejects fractional values for integer columns');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"time_entries":[{"id":"'
    || gen_random_uuid() || '","duration_minutes":2147483648}]}}')
$sql$, '22023', 'Integer value does not fit time_entries.duration_minutes without precision loss',
  'preview rejects integer overflow before casting');
select throws_ok($sql$
  select public.preview_workspace_restore_text('{"app":"AMHIL OS","version":1,"data":{"time_entries":[{"id":"'
    || gen_random_uuid() || '","duration_minutes":-2147483649}]}}')
$sql$, '22023', 'Integer value does not fit time_entries.duration_minutes without precision loss',
  'preview rejects integer underflow before casting');
select is((select count(*) from public.time_entries), 0::bigint, 'invalid integer restore leaves workspace unchanged');
select is(public.restore_workspace_backup_text('{"app":"AMHIL OS","version":1,"data":{"time_entries":[{"id":"'
  || gen_random_uuid() || '","duration_minutes":30.0}]}}')->>'time_entries',
  '1', 'restore accepts a mathematically integral decimal');
select is((select duration_minutes from public.time_entries), 30, 'restored 30.0 is stored as integer 30');
reset role;
select * from finish();
rollback;
