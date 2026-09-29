-- Saved places: restaurants, viewpoints, shops, recommendations... worth
-- keeping before deciding whether (and when) they go in the itinerary.
-- Design rationale: docs/data-model.md (Saved places).
--
-- Workflow: save -> Guardados -> "Agregar al itinerario" -> an activity is
-- created with saved_place_id pointing back. The saved place stays (you may
-- go twice, or move the visit), and the list can show which ones are planned.

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- The city it's in. Optional, same-trip FK below.
  trip_stop_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  -- Same values as activities.category, so "add to itinerary" carries it over.
  category text not null default 'sightseeing'
    check (category in ('sightseeing', 'tour', 'food', 'transfer', 'free_time', 'nightlife', 'shopping', 'other')),
  google_place_id text,
  address text check (char_length(address) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  -- "Aprox. 1 h": becomes the activity's duration when scheduled.
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  -- Where the recommendation came from (a blog, a video...). Only http(s).
  external_url text check (external_url ~* '^https?://' and char_length(external_url) <= 2000),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_places_coords_together check ((lat is null) = (lng is null)),
  constraint saved_places_trip_id_id_key unique (trip_id, id),
  constraint saved_places_stop_same_trip
    foreign key (trip_id, trip_stop_id) references public.trip_stops (trip_id, id)
    on delete set null (trip_stop_id)
);

create index saved_places_trip_stop_idx on public.saved_places (trip_id, trip_stop_id);

create trigger saved_places_set_updated_at
  before update on public.saved_places
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- An activity can come from a saved place. Deleting the saved place keeps the
-- activity (it's already planned); deleting the activity keeps the place.
-- ---------------------------------------------------------------------------
alter table public.activities
  add column saved_place_id uuid,
  add constraint activities_saved_place_same_trip
    foreign key (trip_id, saved_place_id) references public.saved_places (trip_id, id)
    on delete set null (saved_place_id);

create index activities_saved_place_idx on public.activities (trip_id, saved_place_id) where saved_place_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.saved_places enable row level security;

create policy "saved_places: members can read"
  on public.saved_places for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "saved_places: editors can add"
  on public.saved_places for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "saved_places: editors can update"
  on public.saved_places for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "saved_places: editors can delete"
  on public.saved_places for delete to authenticated
  using (public.can_edit_trip(trip_id));
