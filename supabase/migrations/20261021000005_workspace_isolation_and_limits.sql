-- Freeze writes once during the upgrade so validation and constraint
-- installation see the same set of relationships. Keep the wait bounded.
set local lock_timeout = '5s';

do $$
declare
  table_list text;
  relation record;
  owner_join text;
  owner_expression text;
  violations bigint;
  problems text[] := '{}';
begin
  select string_agg(format('public.%I', table_name), ', ' order by table_name)
  into table_list from workspace_backup_private.inventory();
  execute 'lock table ' || table_list || ' in share row exclusive mode';

  for relation in select * from workspace_backup_private.relationships() loop
    owner_join := '';
    owner_expression := 'child.user_id';
    if relation.child = 'task_tags' then
      owner_join := ' join public.tasks task on task.id = child.task_id';
      owner_expression := 'task.user_id';
    end if;
    execute format(
      'select count(*) from public.%I child join public.%I parent on parent.id = child.%I%s
       where %s is distinct from parent.user_id',
      relation.child, relation.parent, relation.field, owner_join, owner_expression
    ) into violations;
    if violations > 0 then
      problems := array_append(problems, format('%s.%s: %s', relation.child, relation.field, violations));
    end if;
  end loop;
  if cardinality(problems) > 0 then
    raise exception 'Cross-account workspace references must be resolved before this migration'
      using errcode = '23514', detail = array_to_string(problems, ', ');
  end if;
end;
$$;

do $$
declare
  parent_table text;
  relation record;
  old_fk record;
  delete_action text;
begin
  for parent_table in
    select distinct parent from workspace_backup_private.relationships() where child <> 'task_tags' order by parent
  loop
    execute format('alter table public.%1$I add constraint %2$I unique (user_id, id)',
      parent_table, parent_table || '_workspace_owner_id_key');
  end loop;

  for relation in select * from workspace_backup_private.relationships()
    where child <> 'task_tags' order by child, field
  loop
    select c.conname, c.confdeltype into strict old_fk
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and c.conkey = array[a.attnum]
    where c.contype = 'f'
      and c.conrelid = format('public.%I', relation.child)::regclass
      and c.confrelid = format('public.%I', relation.parent)::regclass
      and a.attname = relation.field
      and c.confupdtype = 'a' and not c.condeferrable;

    delete_action := case old_fk.confdeltype
      when 'a' then 'no action'
      when 'c' then 'cascade'
      when 'n' then format('set null (%I)', relation.field)
    end;
    if delete_action is null then
      raise exception 'Unexpected delete action on %.%', relation.child, relation.field;
    end if;

    -- SET NULL clears only the optional foreign ID and preserves ownership.
    execute format(
      'alter table public.%1$I drop constraint %2$I,
       add constraint %2$I foreign key (user_id, %3$I)
       references public.%4$I (user_id, id) on delete %5$s',
      relation.child, old_fk.conname, relation.field, relation.parent, delete_action
    );
  end loop;
end;
$$;

-- Ordinary writes share a lock for their record owner. Maintenance takes
-- the same key exclusively and fails immediately if the owner is busy.
create function workspace_backup_private.owner_write_lock(owner_id uuid, exclusive boolean)
returns void language plpgsql set search_path = ''
as $$
declare
  lock_key bigint := hashtextextended(owner_id::text, 614782913);
  acquired boolean;
begin
  if owner_id is null then
    raise exception 'Workspace owner is required' using errcode = '23502';
  end if;
  if exclusive then
    acquired := pg_try_advisory_xact_lock(lock_key);
  else
    acquired := pg_try_advisory_xact_lock_shared(lock_key);
  end if;
  if not acquired then
    raise exception 'Workspace data is busy. Please retry.' using errcode = '55P03';
  end if;
end;
$$;

create or replace function workspace_backup_private.lock_writes()
returns void language plpgsql set search_path = ''
as $$
begin
  perform workspace_backup_private.owner_write_lock(workspace_backup_private.require_owner(), true);
end;
$$;

create function workspace_backup_private.guard_workspace_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform workspace_backup_private.owner_write_lock(old.user_id, false);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Workspace record ownership cannot change' using errcode = '23514';
  end if;
  -- Let the existing INSERT policy reject a caller-supplied foreign owner
  -- without trying to acquire that owner's advisory lock.
  if tg_op = 'INSERT' and current_setting('role', true) = 'authenticated'
     and new.user_id is distinct from auth.uid() then
    return new;
  end if;
  perform workspace_backup_private.owner_write_lock(new.user_id, false);
  return new;
end;
$$;

-- A task-tag pair has no user_id column. Its two existing foreign keys
-- retain their cascades. A constraint trigger verifies the two owners.
create function workspace_backup_private.check_task_tag_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  task_owner uuid;
  tag_owner uuid;
begin
  select user_id into task_owner from public.tasks where id = new.task_id;
  select user_id into tag_owner from public.tags where id = new.tag_id;
  if task_owner is null or tag_owner is distinct from task_owner then
    raise exception 'Task and tag must have the same workspace owner' using errcode = '23503';
  end if;
  return null;
end;
$$;

create constraint trigger task_tags_same_workspace_owner
after insert or update on public.task_tags
for each row execute function workspace_backup_private.check_task_tag_owner();

create function workspace_backup_private.lock_task_tag_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  old_owner uuid;
  new_owner uuid;
begin
  if tg_op <> 'INSERT' then
    select user_id into old_owner from public.tasks where id = old.task_id;
  end if;
  if tg_op = 'DELETE' then
    -- A task cascade can run after the task is gone. Its parent DELETE
    -- already holds the lock, and the pair has the same owner by constraint.
    if old_owner is not null then
      perform workspace_backup_private.owner_write_lock(old_owner, false);
    end if;
    return old;
  end if;
  select user_id into new_owner from public.tasks where id = new.task_id;
  if tg_op = 'INSERT' and current_setting('role', true) = 'authenticated'
     and new_owner is distinct from auth.uid() then
    return new;
  end if;
  if new_owner is null or (tg_op = 'UPDATE' and old_owner is distinct from new_owner) then
    raise exception 'Task-tag link ownership cannot change' using errcode = '23503';
  end if;
  perform workspace_backup_private.owner_write_lock(new_owner, false);
  return new;
end;
$$;

create trigger workspace_owner_write_lock before insert or update or delete on public.task_tags
for each row execute function workspace_backup_private.lock_task_tag_write();

do $$
declare
  item record;
begin
  for item in select * from workspace_backup_private.inventory() where table_name <> 'task_tags' loop
    execute format('create trigger workspace_owner_write_lock
      before insert or update or delete on public.%I
      for each row execute function workspace_backup_private.guard_workspace_write()', item.table_name);
  end loop;
end;
$$;

revoke all on function workspace_backup_private.owner_write_lock(uuid, boolean),
  workspace_backup_private.guard_workspace_write(), workspace_backup_private.check_task_tag_owner(),
  workspace_backup_private.lock_task_tag_write() from public, anon, authenticated;

-- Also bound waits on physical row locks, including locks held by
-- transactions that have selected a row for update without writing yet.
alter function public.restore_workspace_backup(jsonb) set lock_timeout = '2s';
alter function public.reset_workspace_data() set lock_timeout = '2s';

-- 3 MiB leaves more than 1 MB beneath the default Vercel request and
-- buffered response limit, including HTTP and application overhead.
create or replace function workspace_backup_private.check_size(payload jsonb)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if payload is null or octet_length(payload::text) > 3145728 then
    raise exception 'Backup exceeds the supported size limit (3 MiB)' using errcode = '22023';
  end if;
end;
$$;
