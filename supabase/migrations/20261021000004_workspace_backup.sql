-- Backup format v2 covers the workspace only. Internal helpers are outside
-- the Data API schema and the public entry points derive their owner from Auth.
create schema workspace_backup_private;
revoke all on schema workspace_backup_private from public, anon, authenticated;

create function workspace_backup_private.inventory()
returns table (dependency_order integer, table_name text, columns text[])
language sql immutable set search_path = ''
as $$
  select item.dependency_order, item.table_name, string_to_array(item.fields, ' ')
  from (values
    (1, 'clients', 'id user_id name company email phone country source status notes created_at updated_at'),
    (2, 'goals', 'id user_id title description category start_date target_date status progress created_at updated_at position'),
    (3, 'leads', 'id user_id name company contact source status estimated_value notes contacted_at converted_at created_at updated_at converted_client_id'),
    (4, 'learning_areas', 'id user_id name description created_at updated_at'),
    (5, 'tags', 'id user_id name color created_at'),
    (6, 'habits', 'id user_id name description frequency target is_active created_at updated_at goal_id'),
    (7, 'projects', 'id user_id name description status start_date target_date completed_at client_id goal_id category budget estimated_hours notes created_at updated_at'),
    (8, 'project_milestones', 'id user_id project_id title description due_date completed_at status created_at updated_at'),
    (9, 'learning_topics', 'id user_id area_id name status progress confidence started_at completed_at notes created_at updated_at goal_id'),
    (10, 'tasks', 'id user_id title description status priority due_date completed_at estimated_minutes project_id goal_id category notes created_at updated_at position'),
    (11, 'subtasks', 'id user_id task_id title is_completed completed_at position created_at updated_at'),
    (12, 'learning_sessions', 'id user_id topic_id date duration_minutes notes what_learned confidence_before confidence_after created_at updated_at'),
    (13, 'habit_completions', 'id user_id habit_id date is_completed note created_at updated_at'),
    (14, 'time_entries', 'id user_id project_id task_id category date start_time end_time duration_minutes description created_at updated_at'),
    (15, 'income', 'id user_id amount currency date client_id project_id source description status payment_date created_at updated_at'),
    (16, 'expenses', 'id user_id amount currency date category project_id description created_at updated_at'),
    (17, 'notes', 'id user_id title content tags project_id task_id learning_topic_id client_id goal_id created_at updated_at'),
    (18, 'timeline_events', 'id user_id event_type title description occurred_at related_entity_type related_entity_id created_at project_id metadata'),
    (19, 'notifications', 'id user_id type title message related_entity_type related_entity_id is_read created_at updated_at occurred_on'),
    (20, 'crm_leads', 'id user_id name website_url contact status notes date created_at updated_at follow_up_count last_followed_up status_changed_at'),
    (21, 'emergency_fund', 'id user_id target_amount created_at updated_at name'),
    (22, 'emergency_fund_transactions', 'id user_id amount note created_at updated_at fund_id'),
    (23, 'journal_entries', 'id user_id entry_date title story mood highlights challenges lessons tomorrow_focus created_at updated_at'),
    (24, 'task_tags', 'task_id tag_id')
  ) as item(dependency_order, table_name, fields);
$$;

-- Child relationships are shared by export validation, restore, and reset.
create function workspace_backup_private.relationships()
returns table (child text, field text, parent text)
language sql immutable set search_path = ''
as $$
  values
    ('leads', 'converted_client_id', 'clients'),
    ('habits', 'goal_id', 'goals'),
    ('projects', 'client_id', 'clients'),
    ('projects', 'goal_id', 'goals'),
    ('project_milestones', 'project_id', 'projects'),
    ('learning_topics', 'area_id', 'learning_areas'),
    ('learning_topics', 'goal_id', 'goals'),
    ('tasks', 'project_id', 'projects'),
    ('tasks', 'goal_id', 'goals'),
    ('subtasks', 'task_id', 'tasks'),
    ('learning_sessions', 'topic_id', 'learning_topics'),
    ('habit_completions', 'habit_id', 'habits'),
    ('time_entries', 'project_id', 'projects'),
    ('time_entries', 'task_id', 'tasks'),
    ('income', 'client_id', 'clients'),
    ('income', 'project_id', 'projects'),
    ('expenses', 'project_id', 'projects'),
    ('notes', 'project_id', 'projects'),
    ('notes', 'task_id', 'tasks'),
    ('notes', 'learning_topic_id', 'learning_topics'),
    ('notes', 'client_id', 'clients'),
    ('notes', 'goal_id', 'goals'),
    ('timeline_events', 'project_id', 'projects'),
    ('emergency_fund_transactions', 'fund_id', 'emergency_fund'),
    ('task_tags', 'task_id', 'tasks'),
    ('task_tags', 'tag_id', 'tags');
$$;

create function workspace_backup_private.require_owner()
returns uuid language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_account() then
    raise exception 'An approved account is required' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function workspace_backup_private.counts(owner_id uuid)
returns jsonb language plpgsql stable set search_path = ''
as $$
declare
  item record;
  total bigint;
  result jsonb := '{}';
begin
  for item in select * from workspace_backup_private.inventory() loop
    if item.table_name = 'task_tags' then
      select count(*) into total
      from public.task_tags link join public.tasks task on task.id = link.task_id
      where task.user_id = owner_id;
    else
      execute format('select count(*) from public.%I where user_id = $1', item.table_name)
        into total using owner_id;
    end if;
    result := result || jsonb_build_object(item.table_name, total);
  end loop;
  return result;
end;
$$;

-- Serialize these maintenance operations against ordinary workspace writes
-- and against competing maintenance requests, including direct Data API use.
create function workspace_backup_private.lock_writes()
returns void language plpgsql set search_path = ''
as $$
declare
  table_list text;
begin
  select string_agg(format('public.%I', table_name), ', ' order by table_name)
    into table_list from workspace_backup_private.inventory();
  execute 'lock table ' || table_list || ' in share row exclusive mode nowait';
exception when lock_not_available then
  raise exception 'Workspace data is busy. Please retry.' using errcode = '55P03';
end;
$$;

create function workspace_backup_private.lock_approved_owner(owner_id uuid)
returns void language plpgsql set search_path = ''
as $$
declare
  account_status text;
begin
  select status into account_status from public.profiles where id = owner_id for share nowait;
  if account_status is distinct from 'approved' then
    raise exception 'An approved account is required' using errcode = '42501';
  end if;
exception when lock_not_available then
  raise exception 'Workspace data is busy. Please retry.' using errcode = '55P03';
end;
$$;

create function workspace_backup_private.id_maps(data jsonb, remap boolean)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  item record;
  mapping jsonb;
  maps jsonb := '{}';
begin
  for item in select * from workspace_backup_private.inventory() where table_name <> 'task_tags' loop
    select coalesce(jsonb_object_agg(
      (row_data->>'id')::uuid::text,
      case when remap then gen_random_uuid() else (row_data->>'id')::uuid end
    ), '{}')
    into mapping from jsonb_array_elements(data->item.table_name) as rows(row_data);
    if (select count(*) from jsonb_object_keys(mapping)) <> jsonb_array_length(data->item.table_name) then
      raise exception 'Duplicate record ID in %', item.table_name using errcode = '22023';
    end if;
    maps := maps || jsonb_build_object(item.table_name, mapping);
  end loop;
  return maps;
end;
$$;

create function workspace_backup_private.resolve_soft_parent(entity_type text)
returns text language sql immutable set search_path = ''
as $$
  select case entity_type
    when 'client' then 'clients' when 'lead' then 'leads' when 'project' then 'projects'
    when 'task' then 'tasks' when 'goal' then 'goals' when 'habit' then 'habits'
    when 'learning_topic' then 'learning_topics' when 'income' then 'income'
    when 'expense' then 'expenses' when 'time_entry' then 'time_entries' when 'note' then 'notes'
  end;
$$;

create function workspace_backup_private.map_links(
  entity text, row_data jsonb, maps jsonb, tolerate_historical_links boolean
)
returns jsonb language plpgsql stable set search_path = ''
as $$
declare
  relation record;
  mapped jsonb;
  related_table text;
begin
  for relation in select * from workspace_backup_private.relationships() where child = entity loop
    if row_data->>relation.field is null then continue; end if;
    mapped := maps->relation.parent->((row_data->>relation.field)::uuid::text);
    if mapped is null then
      raise exception 'Unrestorable relationship %.%', entity, relation.field using errcode = '22023';
    end if;
    row_data := jsonb_set(row_data, array[relation.field], mapped);
  end loop;

  if entity in ('timeline_events', 'notifications') and row_data->>'related_entity_id' is not null then
    related_table := workspace_backup_private.resolve_soft_parent(row_data->>'related_entity_type');
    mapped := maps->related_table->((row_data->>'related_entity_id')::uuid::text);
    if mapped is null and not tolerate_historical_links then
      raise exception 'Unrestorable activity link in %', entity using errcode = '22023';
    end if;
    row_data := jsonb_set(row_data, '{related_entity_id}', coalesce(mapped, 'null'));
  end if;

  if entity = 'timeline_events' and row_data#>>'{metadata,area_id}' is not null then
    mapped := maps->'learning_areas'->((row_data#>>'{metadata,area_id}')::uuid::text);
    if mapped is null and not tolerate_historical_links then
      raise exception 'Unrestorable timeline learning-area link' using errcode = '22023';
    end if;
    row_data := jsonb_set(row_data, '{metadata,area_id}', coalesce(mapped, 'null'));
  end if;
  return row_data;
end;
$$;

-- Escape all angle brackets, then re-enable a finite set of exact,
-- attribute-free formatting tags. Existing HTML entities remain text.
create function workspace_backup_private.clean_note(content text)
returns text language sql immutable strict set search_path = ''
as $$
  select regexp_replace(
    replace(replace(content, '<', '&lt;'), '>', '&gt;'),
    '&lt;(/?(?:b|strong|i|em|u|s|strike|p|div|ul|ol|li|blockquote|pre|code|h[1-6]|br))&gt;',
    '<\1>', 'g'
  );
$$;

-- Kept at both the upload boundary and the direct SQL RPC boundary.
create function workspace_backup_private.check_size(payload jsonb)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if payload is null or octet_length(payload::text) > 8388608 then
    raise exception 'Backup exceeds the supported size limit (8 MiB)' using errcode = '22023';
  end if;
end;
$$;

create function public.export_workspace_backup()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  item record;
  rows jsonb;
  normalized jsonb;
  data jsonb := '{}';
  totals jsonb := '{}';
  maps jsonb;
  warnings text[] := '{}';
  payload jsonb;
  columns_sql text;
begin
  for item in select * from workspace_backup_private.inventory() order by dependency_order loop
    if item.table_name = 'task_tags' then
      select coalesce(jsonb_agg(to_jsonb(link) order by link.task_id, link.tag_id), '[]')
      into rows from public.task_tags link join public.tasks task on task.id = link.task_id
      where task.user_id = owner_id;
    else
      select string_agg(format('%I', column_name), ', ') into columns_sql
      from unnest(item.columns) as col(column_name) where column_name <> 'user_id';
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(record) order by record.id), ''[]'')
         from (select %s from public.%I where user_id = $1) record', columns_sql, item.table_name
      ) into rows using owner_id;
    end if;
    data := data || jsonb_build_object(item.table_name, rows);
    totals := totals || jsonb_build_object(item.table_name, jsonb_array_length(rows));
  end loop;

  maps := workspace_backup_private.id_maps(data, false);
  for item in select * from workspace_backup_private.inventory() loop
    rows := data->item.table_name;
    select coalesce(jsonb_agg(workspace_backup_private.map_links(item.table_name, row_data, maps, true)
      order by source.row_order), '[]')
    into normalized from jsonb_array_elements(rows) with ordinality as source(row_data, row_order);
    if rows <> normalized then
      warnings := array_append(warnings, 'Unavailable historical links were cleared in ' || item.table_name || '.');
      data := jsonb_set(data, array[item.table_name], normalized);
    end if;
  end loop;

  payload := jsonb_build_object(
    'app', 'AMHIL OS', 'schema', 'amhil.workspace', 'version', 2,
    'exportedAt', statement_timestamp(), 'counts', totals, 'warnings', to_jsonb(warnings), 'data', data
  );
  perform workspace_backup_private.check_size(payload);
  return payload;
end;
$$;

create function workspace_backup_private.prepare(payload jsonb, owner_id uuid)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  backup_version integer;
  data jsonb;
  result jsonb := '{}';
  totals jsonb := '{}';
  maps jsonb;
  rows jsonb;
  defaults jsonb;
  normalized jsonb;
  item record;
  col record;
  constraint_sql record;
  key text;
  invalid boolean;
  omitted text[] := '{}';
  warnings text[] := '{}';
begin
  perform workspace_backup_private.check_size(payload);
  if jsonb_typeof(payload) is distinct from 'object' or payload->>'app' is distinct from 'AMHIL OS'
     or jsonb_typeof(payload->'data') is distinct from 'object'
     or jsonb_typeof(payload->'version') is distinct from 'number'
  then
    raise exception 'Invalid AMHIL OS backup' using errcode = '22023';
  end if;
  if payload->'version' not in ('1'::jsonb, '2'::jsonb) then
    raise exception 'Unsupported backup version' using errcode = '22023';
  end if;
  backup_version := (payload->>'version')::numeric::integer;
  if backup_version = 2 and (
    payload->>'schema' is distinct from 'amhil.workspace'
    or jsonb_typeof(payload->'counts') is distinct from 'object'
    or jsonb_typeof(payload->'exportedAt') is distinct from 'string'
    or not pg_input_is_valid(payload->>'exportedAt', 'timestamp with time zone')
    or (payload ? 'warnings' and jsonb_typeof(payload->'warnings') <> 'array')
    or payload - array['app','schema','version','exportedAt','counts','warnings','data'] <> '{}'
  ) then
    raise exception 'Invalid version 2 backup metadata' using errcode = '22023';
  end if;
  if backup_version = 1 and payload - array['app','version','exportedAt','data'] <> '{}' then
    raise exception 'Invalid version 1 backup metadata' using errcode = '22023';
  end if;

  data := payload->'data';
  for key in select jsonb_object_keys(data) loop
    if backup_version = 1 and key = 'profiles' then
      if jsonb_typeof(data->key) <> 'array' then
        raise exception 'Invalid legacy profile section' using errcode = '22023';
      end if;
      continue;
    end if;
    if not exists (select 1 from workspace_backup_private.inventory() where table_name = key) then
      raise exception 'Unsupported table in backup' using errcode = '22023';
    end if;
  end loop;

  for item in select * from workspace_backup_private.inventory() order by dependency_order loop
    rows := data->item.table_name;
    if rows is null and backup_version = 1 then
      omitted := array_append(omitted, item.table_name);
      rows := '[]';
    end if;
    if jsonb_typeof(rows) is distinct from 'array' then
      raise exception 'Missing or invalid table data for %', item.table_name using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(rows) as r(value) where jsonb_typeof(value) <> 'object') then
      raise exception 'Invalid record in %', item.table_name using errcode = '22023';
    end if;
    if backup_version = 1 and item.table_name = 'task_tags' then
      if exists (
        select 1 from jsonb_array_elements(rows) as r(value) where value ? 'tasks'
        and (jsonb_typeof(value->'tasks') is distinct from 'object'
          or (value->'tasks') - 'user_id' <> '{}')
      ) then
        raise exception 'Invalid legacy task-tag owner reference' using errcode = '22023';
      end if;
      select coalesce(jsonb_agg(value - 'tasks'), '[]') into rows from jsonb_array_elements(rows) as r(value);
    end if;
    if exists (
      select 1 from jsonb_array_elements(rows) as r(value), lateral jsonb_object_keys(r.value) as field(name)
      where not (field.name = any(item.columns))
    ) then
      raise exception 'Unsupported field in %', item.table_name using errcode = '22023';
    end if;

    -- Catalog types and defaults validate the fixed allowlist against the
    -- database schema and preserve defaults for historical version 1 files.
    defaults := '{}';
    for col in
      select column_name, is_nullable, column_default, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = item.table_name
        and column_name = any(item.columns) and column_name <> 'user_id'
    loop
      if exists (
        select 1 from jsonb_array_elements(rows) as r(value)
        where (
          col.is_nullable = 'NO' and (
            value->col.column_name = 'null' or
            (not value ? col.column_name and (col.column_default is null or col.column_name = 'id'))
          )
        ) or (
          value ? col.column_name and value->col.column_name <> 'null'
          and jsonb_typeof(value->col.column_name) <> case
            when col.data_type in ('integer','smallint','bigint','numeric','real','double precision') then 'number'
            when col.data_type = 'boolean' then 'boolean'
            when col.data_type = 'ARRAY' then 'array'
            when col.data_type = 'jsonb' then 'object'
            else 'string'
          end
        )
      ) then
        raise exception 'Invalid field %.%', item.table_name, col.column_name using errcode = '22023';
      end if;
      if col.data_type = 'ARRAY' and exists (
        select 1 from jsonb_array_elements(rows) as r(value),
          lateral jsonb_array_elements(
            case when jsonb_typeof(value->col.column_name) = 'array' then value->col.column_name else '[]'::jsonb end
          ) as entry(element)
        where jsonb_typeof(element) <> 'string'
      ) then
        raise exception 'Invalid array in %.%', item.table_name, col.column_name using errcode = '22023';
      end if;
      if col.column_default is not null and col.column_name <> 'id' then
        execute 'select to_jsonb((' || col.column_default || '))' into normalized;
        defaults := defaults || jsonb_build_object(col.column_name, normalized);
      end if;
    end loop;

    -- Populate typed records before running any workspace writes. Strip all
    -- input ownership values, including those in legacy backups.
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(typed) order by source.row_order), ''[]'')
       from jsonb_array_elements($1) with ordinality source(row_data, row_order)
       cross join lateral jsonb_populate_record(null::public.%I,
         $2 || (source.row_data - ''user_id'') || $3) typed', item.table_name
    ) into normalized using rows, defaults, case when item.table_name = 'task_tags'
      then '{}'::jsonb else jsonb_build_object('user_id', owner_id) end;

    for constraint_sql in
      select pg_get_expr(conbin, conrelid) as expression from pg_constraint
      where conrelid = format('public.%I', item.table_name)::regclass and contype = 'c'
    loop
      execute format('select exists (select 1 from jsonb_populate_recordset(null::public.%I, $1) where (%s) is false)',
        item.table_name, constraint_sql.expression) into invalid using normalized;
      if invalid then
        raise exception 'A record violates a rule in %', item.table_name using errcode = '22023';
      end if;
    end loop;

    result := result || jsonb_build_object(item.table_name, normalized);
    totals := totals || jsonb_build_object(item.table_name, jsonb_array_length(rows));
  end loop;
  if backup_version = 2 and payload->'counts' <> totals then
    raise exception 'Backup counts do not match the data' using errcode = '22023';
  end if;

  maps := workspace_backup_private.id_maps(result, true);
  for item in select * from workspace_backup_private.inventory() loop
    rows := result->item.table_name;
    select coalesce(jsonb_agg(
      workspace_backup_private.map_links(item.table_name, row_data, maps, backup_version = 1)
      || case
        when item.table_name = 'task_tags' then '{}'::jsonb
        else jsonb_build_object('id', maps->item.table_name->(row_data->>'id'))
      end
      || case
        when item.table_name = 'notes' then jsonb_build_object(
          'content', workspace_backup_private.clean_note(row_data->>'content'))
        else '{}'::jsonb
      end order by source.row_order), '[]')
    into normalized from jsonb_array_elements(rows) with ordinality as source(row_data, row_order);
    result := jsonb_set(result, array[item.table_name], normalized);
  end loop;

  -- Validate unique combinations before applying data (including composite
  -- joins and indexes whose nullable fields use the default NULLS DISTINCT).
  for item in
    select * from (values
      ('tags', 'name'),
      ('task_tags', 'task_id, tag_id'),
      ('habit_completions', 'habit_id, date'),
      ('journal_entries', 'entry_date'),
      ('notifications', 'type, related_entity_id, occurred_on')
    ) as keys(table_name, fields)
  loop
    execute format(
      'select exists (select 1 from jsonb_populate_recordset(null::public.%I, $1)
        where row(%s) is not null group by %s having count(*) > 1)',
      item.table_name, item.fields, item.fields
    ) into invalid using result->item.table_name;
    if invalid then
      raise exception 'Duplicate records in %', item.table_name using errcode = '22023';
    end if;
  end loop;

  if backup_version = 1 then
    warnings := array_append(warnings, 'Legacy backup. Historical links to missing records are cleared.');
  end if;
  if exists (select 1 from jsonb_array_elements(result->'notes') as r(note) where note->>'content' is not null) then
    warnings := array_append(warnings, 'Note formatting is restricted to safe tags. Links, images, and attributes are escaped.');
  end if;
  return jsonb_build_object('version', backup_version, 'counts', totals, 'omitted', to_jsonb(omitted),
    'warnings', to_jsonb(warnings), 'data', result);
end;
$$;

create function public.preview_workspace_restore(payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  prepared jsonb;
begin
  prepared := workspace_backup_private.prepare(payload, owner_id);
  return (prepared - 'data') || jsonb_build_object('empty', not exists (
    select 1 from jsonb_each_text(workspace_backup_private.counts(owner_id)) where value::bigint > 0
  ));
end;
$$;

create function public.restore_workspace_backup(payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  prepared jsonb;
  item record;
  columns_sql text;
  inserted bigint;
  totals jsonb := '{}';
begin
  prepared := workspace_backup_private.prepare(payload, owner_id);
  perform workspace_backup_private.lock_approved_owner(owner_id);
  perform workspace_backup_private.lock_writes();
  if exists (select 1 from jsonb_each_text(workspace_backup_private.counts(owner_id)) where value::bigint > 0) then
    raise exception 'Restore requires an empty workspace' using errcode = '22023';
  end if;

  for item in select * from workspace_backup_private.inventory() order by dependency_order loop
    select string_agg(format('%I', column_name), ', ') into columns_sql
    from unnest(item.columns) as col(column_name);
    execute format('insert into public.%1$I (%2$s)
      select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)', item.table_name, columns_sql)
      using prepared->'data'->item.table_name;
    get diagnostics inserted = row_count;
    if inserted <> (prepared->'counts'->>item.table_name)::bigint then
      raise exception 'Restore did not write every record in %', item.table_name;
    end if;
    totals := totals || jsonb_build_object(item.table_name, inserted);
  end loop;
  return totals;
end;
$$;

create function public.reset_workspace_data()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  relation record;
  item record;
  owner_expression text;
  owner_join text;
  unsafe boolean;
  removed bigint;
  totals jsonb := '{}';
begin
  perform workspace_backup_private.lock_approved_owner(owner_id);
  perform workspace_backup_private.lock_writes();

  -- A referential action can bypass child RLS. Detect other owners before any
  -- delete, using the same locks to keep new references out until commit.
  for relation in select * from workspace_backup_private.relationships() loop
    owner_join := '';
    owner_expression := 'child.user_id';
    if relation.child = 'task_tags' then
      owner_join := ' join public.tasks task on task.id = child.task_id';
      owner_expression := 'task.user_id';
    end if;
    execute format(
      'select exists (select 1 from public.%I child join public.%I parent on parent.id = child.%I%s
       where (parent.user_id = $1 or %5$s = $1) and %5$s is distinct from parent.user_id)',
      relation.child, relation.parent, relation.field, owner_join, owner_expression
    ) into unsafe using owner_id;
    if unsafe then
      raise exception 'Reset blocked by a cross-account workspace relationship' using errcode = '22023';
    end if;
  end loop;

  for item in select * from workspace_backup_private.inventory() order by dependency_order desc loop
    if item.table_name = 'task_tags' then
      delete from public.task_tags link using public.tasks task
      where link.task_id = task.id and task.user_id = owner_id;
    else
      execute format('delete from public.%I where user_id = $1', item.table_name) using owner_id;
    end if;
    get diagnostics removed = row_count;
    totals := totals || jsonb_build_object(item.table_name, removed);
  end loop;
  return totals;
end;
$$;

revoke all on all functions in schema workspace_backup_private from public, anon, authenticated;
revoke all on function public.export_workspace_backup(), public.preview_workspace_restore(jsonb),
  public.restore_workspace_backup(jsonb), public.reset_workspace_data() from public, anon, authenticated;
grant execute on function public.export_workspace_backup(), public.preview_workspace_restore(jsonb),
  public.restore_workspace_backup(jsonb), public.reset_workspace_data() to authenticated;
