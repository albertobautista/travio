# Demo data

Realistic sample trips for trying the app locally. Not a migration and not
`seed.sql`: nothing here runs automatically.

## España 2026

A 15-day trip (27 sep – 11 oct 2026): Barcelona, Madrid, Sevilla and Málaga.
2 travelers (the owner and "Ximena", without an account), 4 stays, 7 legs with
seats (flights, AVE trains, bus, car rental) and 125 activities, including the
transfers between them. Cities, stays and every non-transfer activity get
approximate coordinates, so the Map page works without any Places requests. The dates overlap "today" (late September 2026) so the
Hoy screen has something to show; shift them in the SQL for another period.

### 1. Trip, stays, transportation and activities

The owner must already have an account in local Supabase:

```bash
docker exec -i supabase_db_travio psql -U postgres -v ON_ERROR_STOP=1 \
  -v owner_email=you@example.com < supabase/demo/espana-2026.sql
```

The script inserts everything as that user (`role authenticated` plus their JWT
claims), so RLS, defaults and triggers apply exactly as in the app. Running it
twice creates two trips.

### 2. Documents (optional)

Files can't be created from SQL: they live in Storage and go through the
upload flow. `espana-2026-documents.js` generates 25 PDFs (boarding passes,
train tickets, hotel confirmations, entry tickets, insurance) and 2 PNG tickets
in the browser and submits them through the real upload form.

1. Sign in as the trip's owner (or an editor) and open the trip's **Documentos** page.
2. Paste the contents of `espana-2026-documents.js` into the browser console.
3. Wait about a minute; it prints one line per file (`ok` or the error).

### 3. Extension: Granada, Valencia and San Sebastián (optional)

Adds three cities after Málaga and stretches the trip to 23 days
(27 sep – 19 oct 2026): 3 stays, 4 legs (bus, two Vueling flights, airport
bus), 82 activities with coordinates, 7 saved places and 3 expenses. The
return flights move to 19 oct and leave from San Sebastián (same booking).
Run it once, after step 1, with the same owner:

```bash
docker exec -i supabase_db_travio psql -U postgres -v ON_ERROR_STOP=1 \
  -v owner_email=you@example.com < supabase/demo/espana-2026-extension.sql
```

It refuses to run twice (it checks for Granada). For its 11 documents, paste
`espana-2026-extension-documents.js` into the console on the trip's
Documentos page, like step 2.
