-- Denormalize email onto `profiles` so the admin approval queue can show who
-- someone is without a service-role key or exposing `auth.users` through
-- PostgREST — `profiles` already flows through normal RLS + the anon/
-- authenticated roles, `auth.users` does not.

alter table public.profiles add column email text;

update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, email, full_name, role, status, approved_at)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'admin', 'approved', now());
  else
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  end if;
  return new;
end;
$$;
