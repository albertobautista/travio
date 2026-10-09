# Travio

Mobile-first travel planning web app: the whole trip (itinerary, stays, transport, tickets, travelers) in one place.

Stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase.

- Product and project context: [`CLAUDE.md`](CLAUDE.md)
- Data model and permissions: [`docs/data-model.md`](docs/data-model.md)

## Development

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
cp .env.example .env.local   # then paste the publishable key from `supabase status`
supabase start      # local Postgres, Auth, Storage and Studio (http://127.0.0.1:54323)
npm run dev
```

Open http://localhost:3000.

## Database

- Migrations live in `supabase/migrations/` and are plain SQL.
- New migration: `supabase migration new <name>`; rebuild the local database from the migrations: `supabase db reset`.
- After changing the schema, regenerate the TypeScript types: `npm run db:types`.

## Tests

```bash
npm test            # Vitest: schedule, conflicts, dates, Today, budget split… (src/lib/**/*.test.ts)
npm run typecheck   # route types + tsc
npm run test:db     # pgTAP against the local database: RLS and invitations (supabase/tests/)
```

The database tests run inside a transaction that is rolled back, so they leave no data behind. The first `npm run test:db` downloads the pg_prove image and can take a few minutes.

GitHub Actions runs all of this on every push (`.github/workflows/ci.yml`). In Vercel, **Settings → Deployment Checks** requires the "App" and "Database" jobs, so a red build is never promoted to production.

## Authentication

Supabase Auth with email/password and Google. Sessions live in cookies (`@supabase/ssr`); `src/proxy.ts` refreshes them on each request and redirects signed-out users to `/login`. Authorization itself is RLS in the database.

Locally, email confirmation is off, so sign-up signs you in immediately. Emails sent by Auth can be read in Mailpit: http://127.0.0.1:54324.

### Google sign-in

Disabled until you have OAuth credentials:

1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth client ID** of type *Web application*.
2. Add the authorized redirect URI `http://127.0.0.1:54321/auth/v1/callback` (for the hosted project it is `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Create `supabase/.env` (git-ignored) with:

   ```bash
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   ```

4. Set `enabled = true` under `[auth.external.google]` in `supabase/config.toml` and restart: `supabase stop && supabase start`.

## Avisos por correo

Emails go out through [Resend](https://resend.com) (`src/lib/email/send.ts`,
templates in `src/emails/`). Without `RESEND_API_KEY` they're only logged.
Without a verified domain Resend only delivers to the account owner's address.

What sends what:

- **Invitations** and **"X se unió / salió"**: right away, from the server actions.
- **Change summaries** (hourly or daily, per person) and the **reminder the day
  before a trip**: a job at `POST /api/avisos/enviar`, called every 10 minutes by
  `pg_cron` in Supabase (migration `20261005150000_trip_events_and_cron.sql`).
  Changes are recorded by triggers in `trip_events`.

Each environment needs:

1. Env vars (`.env.local` locally, Vercel in production): `SUPABASE_SECRET_KEY`,
   `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (see `.env.example`).
2. Two Vault secrets in that environment's database, so `pg_cron` knows where to
   call and with what (run in the SQL editor, or with psql locally):

   ```sql
   select vault.create_secret('<app url>/api/avisos/enviar', 'notifications_url');
   select vault.create_secret('<same value as CRON_SECRET>', 'notifications_secret');
   ```

   Locally the URL is `http://host.docker.internal:3000/api/avisos/enviar` (the
   database runs in Docker). Without these secrets the job simply doesn't run.

To run the job right away instead of waiting for the clock:
`select public.request_notification_run();` and check `net._http_response`.
