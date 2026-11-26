# Back up, restore, or reset a workspace

Open **Settings → Data & Backup**. Use **Export All Data (JSON)** for a restorable workspace backup. CSV exports are for spreadsheets. The active CRM and the older leads list have separate CSV downloads.

## Backup format

Version 2 uses the following JSON fields.

| Field | Meaning |
| --- | --- |
| `app` | `AMHIL OS` |
| `schema` | `amhil.workspace` |
| `version` | `2` |
| `exportedAt` | Snapshot timestamp |
| `counts` | Record count by table, including empty tables |
| `warnings` | Export notices about unavailable historical links |
| `data` | Arrays of records keyed by table name |

The inventory includes `clients`, `crm_leads`, `emergency_fund`, `emergency_fund_transactions`, `expenses`, `goals`, `habit_completions`, `habits`, `income`, `journal_entries`, `leads`, `learning_areas`, `learning_sessions`, `learning_topics`, `notes`, `notifications`, `project_milestones`, `projects`, `subtasks`, `tags`, `task_tags`, `tasks`, `time_entries`, and `timeline_events`. Authentication accounts, profiles, approval fields, and record owner IDs are excluded. Keep backup files private. They can contain journal entries, contact details, and financial records.

Exports are a single database snapshot. An export with a missing required relationship or a payload above 3 MiB fails as a whole. Historical timeline or notification links to unavailable records are cleared with an export warning. Their activity text and dates are retained.

PostgreSQL validates the snapshot before download and serializes the JSON directly. Timeline metadata can contain any JSON value, including JSON null, and its numbers keep their full PostgreSQL precision. Note tag arrays retain null elements and dimensions. An export with nonstandard PostgreSQL array bounds fails because JSON arrays cannot encode those bounds.

Export, preview, and restore check the size of the workspace after restore transformations. This accounts for note markup that grows when escaped. If the resulting workspace would exceed 3 MiB when re-exported, validation fails before any records are written.

## Restore and compatibility

1. Choose an AMHIL OS JSON backup of up to 3 MiB. The database also applies the limit to its normalized JSON representation, so some manually reformatted files may be rejected even if their uploaded size fits.
2. Review validation, the record counts, and any omissions. Restore requires an empty workspace. If you need to clear existing data, download and keep its backup first, then explicitly confirm reset.
3. Select **Confirm restore**. Restore either applies the whole file or rolls back the entire transaction. IDs and their relationships are remapped, and all records are assigned to the signed-in account. Imported notes keep basic attribute-free formatting. Links, images, and other unsupported markup are escaped.

Escaped text and existing character entities remain literal text. Fixed-precision database columns reject values that would be rounded or overflow. For example, an amount of `1.235` cannot be restored into a two-decimal currency field. Extra trailing zeroes are accepted when the value fits exactly.

Version 1 exports remain supported. They can omit tables, and the preview lists those omissions. The legacy profile section and original ownership fields are ignored. Legacy task-tag links are restored when both records are included. Historical activity pointers to missing records are cleared. Version 2 validates its table counts and requires the full inventory. An older file can only restore what it contains. Both versions reject duplicate JSON object keys so values are never silently overwritten during parsing.

## Reset

Reset atomically removes your workspace records and reports the actual deletion count for every table. It preserves login and profile information. Reset stops before any deletion if it detects a cross-account reference. If the database reports that workspace data is busy, retry after other workspace operations finish.

## Local regression tests

Apply all migrations to disposable local Supabase and run `supabase test db --local` from its project directory. The backup tests use synthetic records and roll back their test transaction.

To run the HTTP smoke test, start the application against the same disposable database. Run `node supabase/tests/backup-http.mjs` with `AMHIL_TEST_APP_URL` and `AMHIL_TEST_API_URL` set to the loopback endpoints. Pass the disposable instance's local legacy keys through `AMHIL_TEST_ANON_KEY` and `AMHIL_TEST_SERVICE_KEY` without printing them.

## Transport and concurrent edits

The JSON download uses a private, uncached HTTP response. Uploads send the raw JSON file. Both directions enforce 3 MiB of UTF-8 JSON, leaving over 1 MB of headroom below Vercel's default 4.5 MB function payload limit. The HTTP regression test measures the request and response bodies plus headers, including multibyte content. An oversize file or export fails explicitly.

Restore and reset use a transaction lock scoped to the current account. Writes for another account can proceed during maintenance. A conflicting write in the same account fails with a retryable busy response. Physical database lock waits during restore and reset are bounded to two seconds.

The same-owner migration checks every existing workspace relationship before replacing foreign keys. If it reports violations, resolve the listed relationships and retry the migration. It reports table and column counts and makes no automatic data changes. Apply migrations in version order before releasing the application that calls the new backup endpoints.

Run `node supabase/tests/workspace-concurrency.mjs` with the disposable database URL in `AMHIL_TEST_DB_URL` to test concurrent transactions against PostgreSQL. The test requires `psql` and a loopback database.

If the restore response is lost, the operation may already have committed. Check the workspace and request a fresh eligibility check in Data Settings before trying again. The app does not retry automatically. An eligibility check can tell you whether the workspace is empty; it cannot confirm which request populated it.

The optional browser regression suite, `supabase/tests/workspace-browser.mjs`, uses `playwright-core` and a local Chromium or Chrome executable. Install the browser runner in an isolated test copy with `npm install --no-save --package-lock=false playwright-core`. Set `AMHIL_TEST_BROWSER_EXECUTABLE` to the executable path and use the same disposable endpoints and keys as the HTTP suite.
