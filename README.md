# Travio

Mobile-first travel planning web app: the whole trip (itinerary, stays, transport, tickets, travelers) in one place.

Stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase.

- Product and project context: [`CLAUDE.md`](CLAUDE.md)
- Data model and permissions: [`docs/data-model.md`](docs/data-model.md)

## Development

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
supabase start      # local Postgres, Auth, Storage and Studio (http://127.0.0.1:54323)
npm run dev
```

Open http://localhost:3000.

## Database

- Migrations live in `supabase/migrations/` and are plain SQL.
- New migration: `supabase migration new <name>`; rebuild the local database from the migrations: `supabase db reset`.
- After changing the schema, regenerate the TypeScript types: `npm run db:types`.
