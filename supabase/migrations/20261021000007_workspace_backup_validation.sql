-- Recognize permitted tags only in the original markup. Entity-escaped
-- examples are text and never become formatting.
create or replace function workspace_backup_private.clean_note(content text)
returns text language sql immutable strict set search_path = ''
as $$
  select coalesce(string_agg(
    case when part[1] ~ '^</?(?:b|strong|i|em|u|s|strike|p|div|ul|ol|li|blockquote|pre|code|h[1-6]|br)>$'
      then part[1]
      else replace(replace(part[1], '<', '&lt;'), '>', '&gt;')
    end, '' order by ordinal
  ), '')
  from regexp_matches(content, $tokens$<(?:"[^"]*"|'[^']*'|[^<>"'])*>|[^<]+|<+(?=<)|<$tokens$, 'g')
  with ordinality as token(part, ordinal);
$$;

create function workspace_backup_private.backup_envelope(
  data jsonb, totals jsonb, warnings jsonb, exported_at timestamptz
)
returns jsonb language sql stable set search_path = '' set timezone = 'UTC'
as $$
  select jsonb_build_object(
    'app', 'AMHIL OS', 'schema', 'amhil.workspace', 'version', 2,
    'exportedAt', exported_at, 'counts', totals, 'warnings', warnings, 'data', data
  );
$$;

create function workspace_backup_private.check_reexport_size(prepared_data jsonb, totals jsonb)
returns void language plpgsql stable set search_path = '' set timezone = 'UTC'
as $$
declare
  item record;
  projected_data jsonb := '{}';
  rows jsonb;
begin
  -- Ownership is attached to stored rows but excluded from the backup.
  -- All other fields here use the same inventory as the export collector.
  for item in select * from workspace_backup_private.inventory() loop
    select coalesce(jsonb_agg(visible.row_data), '[]') into rows
    from jsonb_array_elements(prepared_data->item.table_name) as source(row_data)
    cross join lateral (
      select jsonb_object_agg(field.key, field.value) as row_data
      from jsonb_each(source.row_data) field
      where field.key = any(item.columns) and field.key <> 'user_id'
    ) visible;
    projected_data := projected_data || jsonb_build_object(item.table_name, rows);
  end loop;

  -- The restored links are already remapped or cleared, so re-export
  -- produces no historical-link warnings. Reserve the full timestamp width
  -- because PostgreSQL omits trailing zeroes in the actual microseconds.
  perform workspace_backup_private.check_size(workspace_backup_private.backup_envelope(
    projected_data, totals, '[]', '9999-12-31 23:59:59.999999+00'::timestamptz
  ));
exception
  when invalid_parameter_value then
    raise exception 'The workspace would exceed the 3 MiB backup limit after restore' using errcode = '22023';
end;
$$;

revoke all on function workspace_backup_private.backup_envelope(jsonb,jsonb,jsonb,timestamptz),
  workspace_backup_private.check_reexport_size(jsonb,jsonb) from public, anon, authenticated;

create or replace function workspace_backup_private.collect_workspace_backup()
returns jsonb language plpgsql stable security definer set search_path = '' set timezone = 'UTC'
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

  payload := workspace_backup_private.backup_envelope(data, totals, to_jsonb(warnings), statement_timestamp());
  perform workspace_backup_private.check_size(payload);
  return payload;
end;
$$;

create or replace function workspace_backup_private.prepare(payload jsonb, owner_id uuid)
returns jsonb language plpgsql set search_path = '' set timezone = 'UTC'
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
      select column_name, is_nullable, column_default, data_type, numeric_precision, numeric_scale
      from information_schema.columns
      where table_schema = 'public' and table_name = item.table_name
        and column_name = any(item.columns) and column_name <> 'user_id'
    loop
      if exists (
        select 1 from jsonb_array_elements(rows) as r(value)
        where (
          col.is_nullable = 'NO' and (
            (value->col.column_name = 'null' and col.data_type <> 'jsonb') or
            (not value ? col.column_name and (col.column_default is null or col.column_name = 'id'))
          )
        ) or (
          value ? col.column_name and value->col.column_name <> 'null'
          and col.data_type <> 'jsonb'
          and jsonb_typeof(value->col.column_name) <> case
            when col.data_type in ('integer','smallint','bigint','numeric','real','double precision') then 'number'
            when col.data_type = 'boolean' then 'boolean'
            when col.data_type = 'ARRAY' then 'array'
            else 'string'
          end
        )
      ) then
        raise exception 'Invalid field %.%', item.table_name, col.column_name using errcode = '22023';
      end if;
      -- Inspect the unconstrained value before a destination typmod can
      -- round it. Trailing zeroes are accepted when the value fits exactly.
      if col.data_type = 'numeric' and col.numeric_precision is not null
         and col.numeric_scale is not null and exists (
        select 1 from jsonb_array_elements(rows) as r(value)
        cross join lateral (select (value->>col.column_name)::numeric as exact) input
        where input.exact <> trunc(input.exact, col.numeric_scale)
           or abs(input.exact) >= power(10::numeric, col.numeric_precision - col.numeric_scale)
      ) then
        raise exception 'Numeric value does not fit %.% without precision loss',
          item.table_name, col.column_name using errcode = '22023';
      end if;
      if col.data_type = 'ARRAY' and exists (
        select 1 from jsonb_array_elements(rows) as r(value)
        where jsonb_typeof(value->col.column_name) = 'array'
          and not workspace_backup_private.valid_text_array(value->col.column_name, 1)
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

  perform workspace_backup_private.check_reexport_size(result, totals);

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

create or replace function public.restore_workspace_backup(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s'
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  prepared jsonb;
  item record;
  columns_sql text;
  values_sql text;
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
    -- jsonb_populate_record turns JSON null into SQL NULL. Read the JSONB
    -- field directly so a stored JSON null remains a valid JSONB value.
    select string_agg(
      case when item.table_name = 'timeline_events' and column_name = 'metadata'
        then 'source.row_data->''metadata'''
        else format('typed.%I', column_name)
      end, ', ')
    into values_sql from unnest(item.columns) as col(column_name);
    execute format('insert into public.%1$I (%2$s)
      select %3$s from jsonb_array_elements($1) as source(row_data)
      cross join lateral jsonb_populate_record(null::public.%1$I, source.row_data) as typed',
      item.table_name, columns_sql, values_sql)
      using prepared->'data'->item.table_name;
    get diagnostics inserted = row_count;
    if inserted <> (prepared->'counts'->>item.table_name)::bigint then
      raise exception 'Restore did not write every record in %', item.table_name;
    end if;
    totals := totals || jsonb_build_object(item.table_name, inserted);
  end loop;
  -- Verify the actual persisted representation while the owner write lock
  -- is still held. An unexpected insert-time transformation rolls back all rows.
  perform workspace_backup_private.collect_workspace_backup();
  return totals;
end;
$$;
