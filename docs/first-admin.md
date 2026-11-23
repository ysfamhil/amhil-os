# Provision the first administrator

Apply all migrations before onboarding users. Signup creates a pending ordinary profile, including when the email matches an older installation's owner address. Existing administrators keep their current roles and status.

Use this one-time procedure for a fresh installation without an approved administrator.

1. Create an account through Supabase Auth and verify control of the intended email and account. In the trusted Supabase Auth administration interface, confirm the identity and copy its immutable user UUID.
2. Open a trusted SQL session as the database administrator. Confirm you are connected to the intended installation. Replace the placeholder below with the verified UUID and run the block. The statement runs atomically and fails if an approved administrator already exists, the account is unverified, or exactly one pending ordinary profile cannot be promoted.
3. Sign in with the provisioned account and verify that it opens the Admin screen. Use that screen to manage other users.

```sql
do $$
declare
  first_admin_id constant uuid := 'replace-with-verified-auth-user-uuid';
  affected_rows integer;
begin
  lock table public.profiles in share row exclusive mode;

  if exists (select 1 from public.profiles where role = 'admin' and status = 'approved') then
    raise exception 'An approved administrator already exists';
  end if;

  update public.profiles as profile
  set role = 'admin', status = 'approved', approved_at = now(), approved_by = null
  from auth.users as account
  where profile.id = first_admin_id
    and account.id = profile.id
    and account.email_confirmed_at is not null
    and profile.role = 'user'
    and profile.status = 'pending';

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected exactly one verified pending account';
  end if;
end;
$$;
```

Use only the privileged SQL session for provisioning. Keep database and service-role credentials out of the application and any shared logs.

## Run authorization regression tests locally

Use a disposable Supabase project directory with an unused project ID and ports. Copy the migrations and `supabase/tests` into it. Supply a local seed file or disable seeding in the disposable config. Run `supabase start` and `supabase test db --local` from that directory. The SQL suite creates test users and records inside a transaction and rolls them back.

For the Auth and Data API suite, keep the disposable stack and Mailpit running. In the application checkout, run `node supabase/tests/auth-workflows.mjs` with `AMHIL_TEST_API_URL` and `AMHIL_TEST_MAIL_URL` set to the disposable loopback endpoints. Supply its local legacy API keys through `AMHIL_TEST_ANON_KEY` and `AMHIL_TEST_SERVICE_KEY` without printing them. This suite expects the repository's local email signup settings. It creates and removes its own fixture accounts.
