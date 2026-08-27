# AMHIL OS

A personal operating system — tasks, projects, goals, learning, habits, time tracking, a lightweight CRM, finance, notes, a unified timeline, global search, reports, and optional AI features — built on Next.js (App Router) and Supabase (Postgres + Auth + Row Level Security).

Every record is scoped to its owner via RLS at the database level. Derived values (project progress, net income, learning hours, habit streaks, report totals) are always computed live from source records — never stored and never allowed to drift.

## Stack

- Next.js 16 (App Router, Server Actions, Turbopack) + TypeScript + Tailwind v4
- Supabase — Postgres, Auth, Row Level Security
- Recharts for charts
- `@anthropic-ai/sdk` for the optional AI features (Claude)

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase project's URL and anon key:
   ```bash
   cp .env.local.example .env.local
   ```
3. Apply the database migrations to your linked Supabase project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --linked
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL. Safe to expose to the browser — access is enforced by RLS, not by keeping this secret. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key. Same as above — RLS is the actual security boundary. |
| `ANTHROPIC_API_KEY` | No | Server-only. Enables the AI Assistant, "Explain this report", and AI-generated Weekly/Monthly Review summaries. Every AI feature degrades gracefully with a clear "AI unavailable" message when this is unset — the app is fully functional without it. Never prefix this with `NEXT_PUBLIC_`. |

Never commit `.env.local` — it's already git-ignored.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint

## Deploying

This app deploys cleanly to Vercel (or any Next.js host). Set the environment variables above in your hosting provider's dashboard — the build does not require `ANTHROPIC_API_KEY` at all, and requires no database credentials beyond the two public Supabase variables (all data access happens client-and-server-side through the RLS-scoped Supabase client, never a service-role key).

Database changes ship as SQL migrations in `supabase/migrations/`, applied with `supabase db push --linked` against your linked project — there is no build-time database dependency.

## Backup strategy

Supabase provides automatic infrastructure-level backups (and Point-in-Time Recovery on paid plans). For a portable copy of your own data independent of any one provider, use Settings → Data & Backup in the app to export a full JSON backup (all tables, relationships preserved by id) or per-entity CSVs.
