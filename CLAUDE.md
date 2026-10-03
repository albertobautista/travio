# Travio: project context

> Living project context for AI coding assistants (Claude Code, Copilot) and development in VS Code.
> Source: Alberto's "Context" Google Doc (last updated September 25, 2026), plus decisions and designs shared later in the project.
> Language: Alberto often writes in Spanish; reply in Spanish unless asked otherwise.

@AGENTS.md

## Short AI handoff

You are helping build **Travio**, a mobile-first travel planning web app using Next.js, TypeScript, Tailwind, shadcn/ui and Supabase. Google Maps/Places is the mapping solution. Supabase provides PostgreSQL, Auth and private Storage. Authentication initially supports Google and email/password; Apple is deliberately out of scope.

**Trips** are the central domain object. A trip contains stops/cities, activities, accommodations, transportation, travelers, saved places, files and budget information. Activities have start times and durations and must support schedule-conflict detection. **Travelers** are separate from authenticated users. Authenticated users join trips through **TripMember** with owner, editor or viewer roles. Permissions must be enforced server/database-side with RLS, not only in the UI.

Files such as tickets and reservations are important and sensitive. Use private Supabase Storage buckets, store only metadata/paths in PostgreSQL, validate trip permissions and use temporary/signed access rather than permanent public URLs.

The UI direction is a polished blue/white travel product with cards, imagery, maps and visual timelines. Mobile usage during an active trip is a primary use case. The "Today" experience should make the next activity, directions, accommodation and ticket immediately accessible.

**The developer specifically wants to learn file uploads/storage well**, so explain that implementation carefully rather than hiding it behind unexplained code.

---

## 1. Product vision

Travio is a responsive, mobile-first web application for planning and using trips. The goal is to keep the entire trip in one place instead of spreading information across email, cloud drives, booking apps, notes, and local files.

It should be useful in two distinct moments:

1. **Planning mode**: build the itinerary, save places, upload reservations/tickets, organize lodging and transportation, manage travelers, and estimate the budget.
2. **Travel mode**: quickly answer: Where am I today? What am I doing next? How do I get there? Who is joining? Where is my ticket/reservation?

The product should feel visual, modern, fast, and especially comfortable on a phone.

- Working name: **Travio**. Alternative name retained: **Voyara**.
- Possible tagline: *Your trip, all in one place.*

## 2. Design direction

- Modern blue/white interface, mobile-first responsive design.
- Clean typography, rounded cards, subtle shadows and layering.
- Travel photography where useful; maps integrated into the experience.
- Visual timelines rather than text-heavy schedules.
- Clear status/category chips.
- Desktop sidebar navigation, mobile bottom navigation.
- It should not look like a generic admin dashboard; it should feel like a polished consumer travel product.

### Alberto's own designs (primary visual reference)

Alberto shared his designs on September 26, 2026 (branded "Travel Planner", sample trip **Europa 2026**: London, Krakow, Vienna, Budapest, Madrid; Apr 6–20; 2 travelers; $26,000 MXN). His style is the reference for all UI work:

- Photo-heavy: trip cover hero, thumbnails on activities.
- In-trip tabs: Overview / Itinerary / Map / Accommodations / Transportation / Budget…
- Colored category badges: Confirmed, Accommodation, Sightseeing, Transportation, Tour.
- Timeline with a day column and cards.
- Desktop right rail with trip map, upcoming activities and trip info.
- Trip cards with "% planned" progress; trip dashboard with stat tiles.
- Mockups: https://claude.ai/artifact/FoUH5ysSjmMjWeaUhpN4Bo

### Mockup screens and visual tokens

Screens in the mockups (UI copy is in Spanish):

- Planning (mobile 390×844): Mis viajes, Resumen del viaje, Itinerario, Nueva actividad, Mapa del viaje.
- During the trip (mobile): Hoy, Detalle y ticket, Documentos.
- Desktop (1440×900): Itinerario and Hoy, with left sidebar (Mis viajes / Mapa / Documentos / Presupuesto / Personas), in-trip tabs and right rail (trip map, upcoming activities, trip info / today's tickets).

Tokens used across the mockups (map them to Tailwind/shadcn theme variables):

| Role | Value |
| --- | --- |
| Font / numeric font (times) | Geist / Geist Mono |
| Primary / primary hover | `#1F5EDB` / `#1846A8` |
| Primary soft bg / border | `#E8F0FE` / `#BCD0F7` |
| Text / secondary / muted | `#0B1B33` / `#33455E` / `#5A6B82` |
| Page bg / card bg / border | `#F7F9FC` / `#FFFFFF` / `#E3E8F0` |
| Success (text / bg / bar) | `#0B5E3B` / `#E3F4EC` / `#16A36A` |
| Conflict warning (text / bg / border / dot) | `#8A3F00` / `#FFFBF5` / `#F3C089` / `#C2570C` |
| Timeline rail | `#D9E2F2` |

Shapes: cards radius 14–18px, buttons 10–12px, chips fully rounded; touch targets ≥44px. Timeline rows: dot + mono time + thumbnail/icon + title/meta; conflicts shown inline on the card ("Se solapa 30 min con …" + "Ajustar"). Documents screens state that files are private to the trip's travelers.

### Mobile navigation (confirmed 2026-09-28)

- Outside a trip: Trips / Today (only when a trip is in progress) / More. Revised 2026-10-01: no link may point at a trip the user didn't pick.
- Inside a trip: Today / Itinerary / Map / Documents / More.

Desktop (revised 2026-10-01, to stop repeating sections): the left sidebar only picks the trip (My trips, a shortcut to the trip in progress's Today, trips grouped by in progress / upcoming / undated / past, New trip, account). Inside a trip, tabs show Overview / Today / Itinerary / Map / Documents plus a "More" menu (Accommodations, Transportation, Saved, Budget, Travelers); the right rail stays.

## 3. Technology decisions

Initial stack:

- Next.js, TypeScript, Tailwind CSS, shadcn/ui
- Supabase PostgreSQL, Supabase Auth, Supabase Storage
- Google Maps Platform / Places
- Weather API/provider: to be selected

Do not introduce unnecessary infrastructure for the MVP.

**Data access (decided 2026-09-28)**: no ORM. Schema changes are hand-written SQL migrations managed with the Supabase CLI; the app talks to the database through `supabase-js` with the user's session (so RLS always applies), using types generated with `supabase gen types`.

**Repository setup**: Next.js 16 (App Router, `src/` dir, `@/*` alias), Tailwind v4, shadcn/ui (Radix, "nova" style, Lucide icons), npm. Mockup palette lives as CSS variables in `src/app/globals.css` (`primary`, `success*`, `warning*`, `timeline`, …); use those tokens, not raw hex values.

**Authentication**: Supabase Auth with Google and email/password. Sign in with Apple is intentionally excluded from the initial scope (can be reconsidered later).

## 4. Core domain model (conceptual)

```
User
  |
  +---- TripMember ---- Trip
                         |
                         +---- TripStop
                         |       +---- Accommodation
                         |       +---- SavedPlace
                         |
                         +---- Activity
                         |       +---- ActivityParticipant ---- Traveler
                         |       +---- File
                         |
                         +---- Transportation
                         |       +---- Participants
                         |       +---- File
                         |
                         +---- Traveler
                         +---- File
                         +---- Budget / Expenses
```

This is conceptual, **not** the final SQL schema. The concrete table design (reviewed 2026-09-28) lives in `docs/data-model.md`.

## 5. Users, travelers and permissions

- **User**: an authenticated person with a Travio account.
- **Traveler**: a person participating in a trip. **Does not need an account.** This lets someone add family/friends to activities without forcing everyone to register. A Traveler may later be linked to a User.
- **TripMember**: links an authenticated User to a Trip and controls authorization.

Initial roles:

- **owner**: full control over the trip, members, content and settings.
- **editor**: can create/update trip content but has no owner-level administrative powers.
- **viewer**: read-only access.

Example: Alberto owns and manages a trip; Ximena has a Travio account and is invited as a viewer, so she can see the itinerary and tickets without modifying them.

Permissions must **not** exist only in the frontend. Authorization is also enforced in the backend/database using Supabase **Row Level Security**.

## 6. Trip

Eventual fields: id, owner/membership relationships, name, description/notes, start date, end date, cover image, primary currency, status, created/updated timestamps.

A trip can be created before every detail is known and completed progressively.

## 7. Trip stops / cities

A trip can contain multiple stops, e.g. London → Krakow → Vienna → Budapest → Madrid.

A TripStop represents the user's stay in a city/location. Likely data: city/place, Google Place ID when appropriate, arrival date/time, departure date/time, order, notes.

Stops give geographic/date context to accommodations, activities, saved places, etc.

## 8. Activities

Initial fields/concepts: title, description/notes, category, date, start time, **duration**, **calculated end time**, location, Google Place ID/coordinates, cost, external URL, reservation info, optional participants, attachments, trip, optional trip stop.

Duration is supported from the beginning.

### Schedule conflict detection (from v1)

```
Museum         10:00 → 12:00
Guided tour    11:30 → 14:00
⚠ Schedule conflict
```

Later, with Google Maps travel times:

```
Activity A ends: 13:00
Travel time: 35 min
Activity B starts: 13:20
⚠ Not enough travel time
```

v1 only needs overlap detection; travel-time validation can follow.

## 9. Daily timeline

The itinerary should be highly visual:

- Horizontal day/date selector.
- Vertical timeline with activity cards in chronological order.
- Duration visually represented.
- Category/status, participant avatars/chips.
- Quick access to attachments/tickets.
- Conflict warnings.
- Add-activity action.

Potential view modes: Timeline, Calendar, List.

## 10. Today dashboard

One of the most important screens during an active trip. It answers the immediate questions with minimal interaction:

- Current city, date, current weather, current accommodation.
- "Now" activity and "Next" activity.
- Daily timeline, participants.
- Quick directions, quick ticket/reservation access.
- Relevant warnings, free time between activities.

Goal: while walking through a city, the user should not need to navigate multiple screens to find the next reservation or ticket.

## 11. Accommodations

A first-class entity, not just a regular activity.

Fields: name, trip stop, address, Google Place ID, coordinates, check-in, check-out, booking/reference number, booking URL, notes, participants, attachments, cost.

Check-in and check-out may automatically appear as special events in the itinerary.

Example card: "Your stay in Venice · Hotel … · Check-in 15:00 · [Directions] [View reservation]".

## 12. Transportation

Types: flight, train, bus, ferry, rental car, other.

Data: origin, destination, departure date/time, arrival date/time, carrier/operator, flight/train number, booking reference, seat, terminal/gate/platform when known, booking URL, participants, cost, attachments.

Appears automatically in the itinerary.

## 13. Saved places

Save interesting places before deciding whether they belong in the itinerary: restaurants, cafés, attractions, museums, viewpoints, shops, recommendations.

A SavedPlace belongs to a trip and optionally a TripStop. Google Places provides metadata where possible.

Workflow: discover/save → Saved Places → Add to itinerary → Activity created.

## 14. Google Maps

The chosen mapping ecosystem. Expected usage: place autocomplete, place details, coordinates, maps, pins for activities/accommodations/saved places, directions, travel-time calculations, daily route visualization.

The Map page should eventually filter by day/category and show the route for a selected day.

## 15. Travelers and participation

Each trip has Travelers. An activity can have zero, one or many participating travelers (not everyone attends everything). The same applies to transportation and, where useful, accommodation. Filtering the itinerary by traveler may be added.

## 16. Files and documents (key learning area)

Use **Supabase Storage**. Do **not** store binary file data in PostgreSQL.

PostgreSQL stores metadata: id, trip id, owner/uploader, storage path, original filename, MIME type, size, related entity/type, timestamps.

Files can relate to: Trip, Activity, Accommodation, Transportation (and other entities later).

### Security

Boarding passes, tickets and reservations are sensitive:

- **Private** storage buckets.
- No permanent public URLs.
- Validate authentication and trip permissions.
- Signed/temporary URLs for viewing/downloading.
- Permissions enforced server-side/database-side as well as in the UI.

### UX

Eventually: select files from mobile, drag and drop on desktop, upload PDFs/images, see upload progress, preview supported files, download/open, rename/delete metadata as permitted, attach files directly while editing an activity/accommodation/transport.

The "Documents" page is an organizational view (Flights, Trains, Hotels, Tours, Tickets, Insurance, Other), but the underlying file stays associated with its domain entity, not arbitrary folders.

### Implementation order

Implement file handling early, while the app is still small:

Authentication → Trip + permissions → Minimal private upload → Secure view/download → Full attachment relationships → Drag-and-drop and polished UI.

## 17. Budget

A simple trip budget, without becoming a full financial app. Categories: flights, accommodation, transportation, activities, food, other. Useful info: estimated total, actual spent, category totals, trip currency. Not necessarily part of the earliest MVP.

## 18. Weather

Shown inside Travio, **no weather notifications**. Placement: Today dashboard and city/trip-stop overview. Provider not finalized.

## 19. AI (later feature)

Not required for the MVP. When it comes, it should be contextual, not a generic chatbot. Example: "I have three free hours this afternoon in Venice. What can I do near my hotel without interfering with my 7 PM activity?" It could reason over itinerary, free time, saved places, current city, hotel and activity locations, weather and travel time.

**Do not make AI a dependency for basic trip planning.**

**First version (decided 2026-10-01):** ideas for free gaps (≥ 60 min) in Hoy and the Itinerary ("¿Qué hago?"). Claude Sonnet 5.5 proposes up to 3 places (prioritizing saved ones) via a forced tool call; the browser verifies each in Google Places and checks going + staying + coming back fits the gap. Off by default per trip (`trips.ai_enabled`, only the owner can change it, enforced by a trigger); any member may ask, 30 requests per person per day (`claim_ai_request`). Only city, times, places and weather are sent; no names, documents or booking data. Code in `src/lib/ai/` and `src/app/viajes/[id]/ideas/`.

## 20. Main screens

1. **My Trips**: upcoming, active, past; cover images, dates, cities, planning progress.
2. **Trip Dashboard**: route, upcoming activities, accommodations, transportation, travelers, documents, budget.
3. **Today**: travel-mode dashboard.
4. **Itinerary**: timeline/calendar/list.
5. **Activity Details**: schedule, duration, end time, location/map, participants, cost, reservation, notes, attachments, directions.
6. **Map**: activities, accommodations, transportation points, saved places.
7. **Accommodations**: grouped by stop/city.
8. **Transportation**: flights, trains, etc.
9. **Documents**: trip document wallet/library.
10. **Saved Places**: not necessarily scheduled yet.
11. **People**: travelers and trip members.
12. **Budget**: estimated vs actual spending.

## 21. Creating a trip (guided flow)

1. **Basic info**: name, dates, cover, currency, notes.
2. **Stops**: city, arrival, departure, accommodation if known; show stops visually as a route.
3. **Transportation** between stops.
4. **Travelers**.

The flow must not require everything up front: a trip can be created with minimal info and completed over time.

## 22. MVP philosophy

Build **vertical slices** rather than every table before anything works. High-level sequence:

1. Project/repository setup
2. Supabase setup
3. Authentication
4. Profiles/users
5. Trip CRUD
6. Trip membership and roles
7. Row Level Security
8. Trip stops
9. Basic activities
10. Duration/end-time calculation
11. Conflict detection
12. Minimal Supabase Storage proof-of-concept
13. Secure attachment viewing/downloading
14. Travelers and activity participants
15. Daily itinerary/timeline
16. Accommodations
17. Transportation
18. Today dashboard
19. Google Places/Maps
20. Saved places
21. Weather
22. Budget
23. UI polish
24. Advanced travel-time validation
25. Contextual AI features

This sequence can change as implementation reveals better boundaries.

## 23. Development principles

When assisting with Travio:

- Explain architectural decisions instead of only producing code.
- Prefer maintainability over clever abstractions.
- Avoid premature overengineering.
- Keep TypeScript strict and meaningful.
- Keep domain logic separate from presentation when practical.
- Treat authorization and file security as first-class concerns.
- Build mobile-first; keep components accessible.
- Prefer reusable domain components without building an unnecessary design system.
- Validate on both client and server where security/data integrity requires it.
- Never rely on frontend-only authorization.
- Keep external integrations behind clear boundaries.
- Implement incrementally so each feature can be tested before adding the next.

## 24. Decisions intentionally NOT finalized (do not invent them)

Do not silently decide these. Discuss them with Alberto before implementation when they become relevant:

- [ ] Exact final SQL schema
- [x] ORM vs direct Supabase client/database approach (no ORM, see section 3)
- [x] Final weather provider (Open-Meteo: forecast + archive averages, no key; free for non-commercial use, so revisit if Travio goes commercial; isolated in `src/lib/weather/open-meteo.ts`. Decided 2026-09-30.)
- [ ] Hosting/deployment details
- [x] Exact Google Maps APIs enabled (Maps JavaScript API + Places API (New), browser key restricted by referrer and API; decided 2026-09-29. Routes API added 2026-10-01 for travel times between activities, called from the browser with the same key via Maps JS `Route.computeRoutes`; results are not stored in the database, only cached per session.)
- [x] File size/type limits (10 MB; PDF, JPG, PNG, WebP, HEIC/HEIF; decided 2026-09-29, enforced by the `trip-files` bucket)
- [ ] Image optimization strategy
- [x] Invitation flow (single-use link, 7 days, token stored only as a hash; minimal preview before signing in; no email until hosting/SMTP are decided; `link_traveler_to_account` by email stays as a shortcut for existing accounts. Decided 2026-10-03, details in `docs/data-model.md` section 5.)
- [x] Whether editors can invite other members (no, owner only for now; decided 2026-10-03)
- [x] Exact budget/expense schema (estimated from entity costs + `expenses` for actual spending; per-trip exchange rates in `trip_exchange_rates`, suggested from ECB via Frankfurter but confirmed by the user. Decided 2026-09-30. Splitting expenses between travelers decided 2026-10-01: equal / exact amounts / percentages in `expense_shares` (no rows = everyone), balances with suggested payments, recorded `settlements`; planned costs are not split.)
- [x] Offline/PWA capabilities (decided 2026-10-03): installable (`app/manifest.ts`, plane icons from `scripts/generate-icons.mjs`) and a hand-written service worker (`public/sw.js`, production only; `NEXT_PUBLIC_ENABLE_SW=1` to try it in dev). Offline is **read-only**: trip pages are network-first with the last copy as fallback; the trip in progress (or starting tomorrow) has its pages saved in the background (`OfflineTripSync`); documents are kept on the device only if the user taps "Descargar para el viaje" (opt-in: stored unencrypted). No offline maps (Google's terms). Private caches are deleted on sign out, on the login page and for trips the user lost access to. Code in `src/lib/offline/` and `src/components/offline/`. Note: the Claude desktop browser pane can't register service workers on localhost; test in Chrome.
- [ ] Localization/i18n
- [ ] Testing stack
- [ ] Observability/error monitoring
- [ ] Final product name (Travio preferred; Voyara alternative)
- [x] Final mobile navigation (confirmed, see section 2)

## 25. Immediate next step

1. Review this context.
2. Formalize database entities, fields, relationships and the authorization model.
3. Define the Supabase RLS strategy.
4. Confirm repository architecture.
5. Create the Next.js project.
6. Configure Tailwind/shadcn.
7. Connect Supabase.
8. Implement authentication with Google + email/password.
9. First vertical slice: create/list/open a Trip.
10. Implement permissions and private file storage early.

Do not jump directly into building all screens before the data/authorization foundations are understood.
