-- Trip stops: the cities of a trip, in route order (London -> Krakow -> Vienna).
-- Each stop carries its IANA time zone, which activities in that city will use
-- to show local times. Design rationale: docs/data-model.md, sections 2.3 and 3.

-- ---------------------------------------------------------------------------
-- Time zone validation. Only IANA "Area/Location" names ("Europe/London") and
-- "UTC" are accepted. Postgres alone would also take abbreviations like "EST"
-- (even listed in pg_timezone_names as legacy zones) or offsets like "UTC+3",
-- which don't follow daylight saving time.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_timezone(p_timezone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_timezone = 'UTC'
    or (
      p_timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+/-]+$'
      and p_timezone !~ '^(posix|right)/'
      and exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    )
$$;

-- ---------------------------------------------------------------------------
-- trip_stops
-- ---------------------------------------------------------------------------
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Filled in once Google Places is integrated.
  google_place_id text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  timezone text not null check (public.is_valid_timezone(timezone)),
  -- Local calendar dates of the stay; optional while planning.
  arrives_on date,
  departs_on date,
  -- Route order, 1-based. On insert the trigger below always replaces it with
  -- "end of the route"; the default only makes the column optional for clients.
  position integer not null default 0,
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stops_dates_in_order check (departs_on >= arrives_on),
  constraint trip_stops_position_positive check (position > 0),
  -- Lets other tables reference (trip_id, id) so a row can only point at a
  -- stop of its own trip (docs/data-model.md, 2.2).
  constraint trip_stops_trip_id_id_key unique (trip_id, id),
  -- Deferrable so two stops can swap positions inside one transaction; checked
  -- immediately unless a transaction defers it explicitly.
  constraint trip_stops_position_key unique (trip_id, position) deferrable initially immediate
);

create trigger trip_stops_set_updated_at
  before update on public.trip_stops
  for each row execute function public.set_updated_at();

-- New stops always go to the end of the route; reordering is done with
-- move_trip_stop.
create function public.set_trip_stop_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(position), 0) + 1 into new.position
  from public.trip_stops
  where trip_id = new.trip_id;
  return new;
end;
$$;

create trigger trip_stops_set_position
  before insert on public.trip_stops
  for each row execute function public.set_trip_stop_position();

-- ---------------------------------------------------------------------------
-- Reordering: swap a stop with its neighbour before (-1) or after (+1).
--
-- security invoker (the default): it runs with the caller's permissions, so
-- RLS still applies. `for update` only returns rows the caller may update,
-- which means viewers simply get "not found".
-- ---------------------------------------------------------------------------
create function public.move_trip_stop(p_stop_id uuid, p_direction integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_stop public.trip_stops;
  v_neighbor public.trip_stops;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1' using errcode = '22023';
  end if;

  select * into v_stop from public.trip_stops where id = p_stop_id for update;
  if not found then
    raise exception 'Stop not found' using errcode = 'P0002';
  end if;

  if p_direction = -1 then
    select * into v_neighbor from public.trip_stops
    where trip_id = v_stop.trip_id and position < v_stop.position
    order by position desc limit 1
    for update;
  else
    select * into v_neighbor from public.trip_stops
    where trip_id = v_stop.trip_id and position > v_stop.position
    order by position asc limit 1
    for update;
  end if;

  -- Already first or last: nothing to do.
  if not found then
    return;
  end if;

  -- Between the two updates both stops briefly share a position; deferring
  -- the unique check to the end of the transaction allows that.
  set constraints public.trip_stops_position_key deferred;
  update public.trip_stops set position = v_neighbor.position where id = v_stop.id;
  update public.trip_stops set position = v_stop.position where id = v_neighbor.id;
end;
$$;

revoke execute on function public.move_trip_stop(uuid, integer) from public, anon;
grant execute on function public.move_trip_stop(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write (same as every trip-owned table).
-- ---------------------------------------------------------------------------
alter table public.trip_stops enable row level security;

create policy "trip_stops: members can read"
  on public.trip_stops for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "trip_stops: editors can add"
  on public.trip_stops for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "trip_stops: editors can update"
  on public.trip_stops for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "trip_stops: editors can delete"
  on public.trip_stops for delete to authenticated
  using (public.can_edit_trip(trip_id));
