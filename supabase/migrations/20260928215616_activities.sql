-- Activities: the itinerary. Design rationale: docs/data-model.md (2.3 time,
-- 2.4 conflicts, 2.7 booking status, 3 activities).
--
-- Time model: starts_at is an absolute instant (timestamptz) plus the IANA
-- time zone where the activity happens. The UI shows and edits local wall
-- time ("10:30 in London"); the server converts. The end is never stored:
-- it's starts_at + duration_minutes, computed in the domain layer.
--
-- Participants (travelers) and attached files come in later migrations.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Optional city. Must belong to the same trip (composite foreign key below).
  trip_stop_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  category text not null default 'other'
    check (category in ('sightseeing', 'tour', 'food', 'free_time', 'nightlife', 'shopping', 'other')),
  starts_at timestamptz not null,
  -- Up to 7 days, enough for multi-day tours.
  duration_minutes integer not null check (duration_minutes between 1 and 10080),
  timezone text not null check (public.is_valid_timezone(timezone)),
  location_name text check (char_length(location_name) <= 200),
  address text check (char_length(address) <= 300),
  -- Filled in once Google Places is integrated.
  google_place_id text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  cost_amount numeric(12, 2) check (cost_amount >= 0),
  cost_currency char(3) check (cost_currency ~ '^[A-Z]{3}$'),
  -- Only http(s): a "javascript:" URL rendered as a link would run code in
  -- the browser of whoever clicks it (XSS). The app validates this too.
  external_url text check (external_url ~* '^https?://' and char_length(external_url) <= 2000),
  reservation_ref text check (char_length(reservation_ref) <= 120),
  booking_status text not null default 'planned' check (booking_status in ('planned', 'booked', 'confirmed')),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_cost_has_currency check (cost_amount is null or cost_currency is not null),
  -- For future children (participants, files) to reference (trip_id, id).
  constraint activities_trip_id_id_key unique (trip_id, id),
  -- The stop must be in the same trip. Deleting the stop keeps the activity
  -- and only clears trip_stop_id (Postgres 15+ column list).
  constraint activities_stop_same_trip
    foreign key (trip_id, trip_stop_id) references public.trip_stops (trip_id, id)
    on delete set null (trip_stop_id)
);

-- The itinerary and conflict detection read a trip's activities by time.
create index activities_trip_starts_at_idx on public.activities (trip_id, starts_at);
-- Speeds up the foreign key check when a stop is deleted.
create index activities_trip_stop_idx on public.activities (trip_id, trip_stop_id);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- When a stop's time zone changes, keep its activities at the same local time.
-- Example: London was entered as Europe/Lisbon by mistake. After fixing it,
-- the 10:30 visit should still be at 10:30 London time, which is a different
-- instant. `x at time zone old` gives the local wall time; `... at time zone
-- new` turns that wall time back into an instant in the new zone.
-- Runs with the caller's permissions: whoever may edit the stop may edit the
-- trip's activities.
-- ---------------------------------------------------------------------------
create function public.sync_activity_time_zones()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.activities
  set
    starts_at = (starts_at at time zone old.timezone) at time zone new.timezone,
    timezone = new.timezone
  where trip_id = new.trip_id
    and trip_stop_id = new.id
    and timezone = old.timezone;
  return new;
end;
$$;

create trigger trip_stops_sync_activity_time_zones
  after update of timezone on public.trip_stops
  for each row
  when (old.timezone is distinct from new.timezone)
  execute function public.sync_activity_time_zones();

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;

create policy "activities: members can read"
  on public.activities for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "activities: editors can add"
  on public.activities for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "activities: editors can update"
  on public.activities for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "activities: editors can delete"
  on public.activities for delete to authenticated
  using (public.can_edit_trip(trip_id));
