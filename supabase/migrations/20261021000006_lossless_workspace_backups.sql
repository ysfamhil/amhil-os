-- Keep valid PostgreSQL values round-trippable, including JSON null and
-- multidimensional text arrays with null elements.
create or replace function workspace_backup_private.check_size(payload jsonb)
returns void language plpgsql immutable set search_path = ''
as $$
declare
  number_value jsonb;
  numeric_bytes bigint := 0;
begin
  -- Exponent notation can expand drastically in PostgreSQL's JSON output.
  -- Bound that work before serializing the complete document. Only numbers
  -- with a long representation need this early check.
  if payload is not null then
    for number_value in select jsonb_path_query(payload,
      'strict $.** ? (@.type() == "number" && (@ >= 1e100 || @ <= -1e100 || (@ < 1e-100 && @ > -1e-100)))')
    loop
      numeric_bytes := numeric_bytes + octet_length(number_value::text);
      if numeric_bytes > 3145728 then
        raise exception 'Backup exceeds the supported size limit (3 MiB)' using errcode = '22023';
      end if;
    end loop;
  end if;
  if payload is null or octet_length(payload::text) > 3145728 then
    raise exception 'Backup exceeds the supported size limit (3 MiB)' using errcode = '22023';
  end if;
end;
$$;

create function workspace_backup_private.valid_text_array(value jsonb, nesting integer)
returns boolean language plpgsql immutable strict set search_path = ''
as $$
begin
  if nesting > 6 then return false; end if;
  return not exists (
    select 1 from jsonb_array_elements(value) as entry(element)
    where not case jsonb_typeof(element)
      when 'array' then workspace_backup_private.valid_text_array(element, nesting + 1)
      when 'null' then true
      when 'string' then true
      else false
    end
  );
end;
$$;
revoke all on function workspace_backup_private.valid_text_array(jsonb, integer) from public, anon, authenticated;

create or replace function workspace_backup_private.map_links(
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

  if entity = 'timeline_events'
     and row_data->>'related_entity_type' = 'learning_topic'
     and jsonb_typeof(row_data#>'{metadata,area_id}') = 'string'
     and pg_input_is_valid(row_data#>>'{metadata,area_id}', 'uuid') then
    mapped := maps->'learning_areas'->((row_data#>>'{metadata,area_id}')::uuid::text);
    if mapped is null and not tolerate_historical_links then
      raise exception 'Unrestorable timeline learning-area link' using errcode = '22023';
    end if;
    row_data := jsonb_set(row_data, '{metadata,area_id}', coalesce(mapped, 'null'));
  end if;
  return row_data;
end;
$$;

create or replace function workspace_backup_private.prepare(payload jsonb, owner_id uuid)
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
  return totals;
end;
$$;

-- The collector remains private. Keep the public JSONB endpoint for existing
-- SQL callers, with the same preflight used by the lossless text endpoint.
alter function public.export_workspace_backup() set schema workspace_backup_private;
alter function workspace_backup_private.export_workspace_backup() rename to collect_workspace_backup;
revoke all on function workspace_backup_private.collect_workspace_backup() from public, anon, authenticated;

create function public.export_workspace_backup()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  owner_id uuid := workspace_backup_private.require_owner();
  payload jsonb;
begin
  -- JSON arrays cannot represent custom PostgreSQL lower bounds.
  if exists (
    select 1 from public.notes note
    cross join lateral generate_series(1, array_ndims(note.tags)) as dimensions(dimension)
    where note.user_id = owner_id and array_lower(note.tags, dimension) <> 1
  ) then
    raise exception 'Cannot back up notes with nonstandard tag array bounds' using errcode = '22023';
  end if;

  payload := workspace_backup_private.collect_workspace_backup();
  perform workspace_backup_private.prepare(payload, owner_id);
  return payload;
end;
$$;

-- PostgREST transports the JSON document as a string. Only PostgreSQL
-- parses its embedded numbers. Warnings are carried outside the document.
create function public.export_workspace_backup_text()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  payload jsonb := public.export_workspace_backup();
begin
  return jsonb_build_object('body', payload::text, 'has_warnings', jsonb_array_length(payload->'warnings') > 0);
end;
$$;

create function workspace_backup_private.parse_backup_text(document text)
returns jsonb language plpgsql stable set search_path = ''
as $$
begin
  if document is null or octet_length(document) > 3145728 then
    raise exception 'Backup exceeds the supported size limit (3 MiB)' using errcode = '22023';
  end if;
  if document is not json with unique keys then
    raise exception 'Backup must be valid JSON with unique object keys' using errcode = '22023';
  end if;
  return document::jsonb;
exception
  when invalid_text_representation then
    raise exception 'That file is not valid JSON.' using errcode = '22023';
end;
$$;
revoke all on function workspace_backup_private.parse_backup_text(text) from public, anon, authenticated;

create function public.preview_workspace_restore_text(document text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform workspace_backup_private.require_owner();
  return public.preview_workspace_restore(workspace_backup_private.parse_backup_text(document));
end;
$$;

create function public.restore_workspace_backup_text(document text)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s'
as $$
begin
  perform workspace_backup_private.require_owner();
  return public.restore_workspace_backup(workspace_backup_private.parse_backup_text(document));
end;
$$;

revoke all on function public.export_workspace_backup(), public.export_workspace_backup_text(),
  public.preview_workspace_restore_text(text), public.restore_workspace_backup_text(text)
  from public, anon, authenticated;
grant execute on function public.export_workspace_backup(), public.export_workspace_backup_text(),
  public.preview_workspace_restore_text(text), public.restore_workspace_backup_text(text)
  to authenticated;
