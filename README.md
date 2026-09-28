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
