-- 1. Nobody changes their own sign-in address through Supabase Auth.
--
-- Supabase Auth accepts an e-mail change from any valid session, including the limited one a
-- password-recovery link creates, and the application's policies are not in that path. The app has no
-- change-address screen, so the change is refused at the table: only writes made by the Auth service
-- are blocked. An administrator changes an address with SQL, which runs as a different role.
create function public.refuse_self_service_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin'
     and (new.email is distinct from old.email
          or (coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change)) then
    raise exception 'Email addresses can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_self_service_email_change() from public, anon, authenticated;

create trigger refuse_self_service_email_change
  before update of email, email_change on auth.users
  for each row execute function public.refuse_self_service_email_change();

-- 2. Tell the administrator when an account e-mail is given up on (five attempts, or a day old).
-- The alert goes through the same queue; it carries the address that was not reached and, in the
-- name column, which message it was. A failed alert raises no further alert.
alter table account_email_private.outbox
  drop constraint outbox_kind_check,
  add constraint outbox_kind_check check (kind in (
    'admin_new_registration', 'account_approved', 'account_declined', 'account_suspended', 'account_restored',
    'admin_delivery_failed'
  ));

create function account_email_private.on_delivery_failed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into account_email_private.outbox (kind, user_id, email, full_name)
  values ('admin_delivery_failed', new.user_id, new.email, new.kind);
  return null;
exception when others then
  raise warning 'delivery alert not queued (%)', sqlstate;
  return null;
end;
$$;

revoke execute on function account_email_private.on_delivery_failed() from public, anon, authenticated;

create trigger account_email_alert_on_failure
  after update of failed_at on account_email_private.outbox
  for each row
  when (old.failed_at is null and new.failed_at is not null and new.kind <> 'admin_delivery_failed')
  execute function account_email_private.on_delivery_failed();
