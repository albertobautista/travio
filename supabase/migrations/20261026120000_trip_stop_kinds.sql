-- Kinds of stop: not every city in the route is a place you stay.
--
--   destination  where the trip happens (the default, every stop until now)
--   origin       where you leave from and come back to (home): no dates, no
--                stay; the map starts there and closes the route back to it
--   transit      a connection (Guadalajara -> Mexico City -> London): dated,
--                but no stay is expected
--
-- Origin and transit stops are drawn on the route but don't ask for lodging,
-- aren't "the city you're in today" and aren't counted as the trip's cities.

alter table public.trip_stops
  add column kind text not null default 'destination'
    check (kind in ('destination', 'origin', 'transit'));

-- The origin is home, not a stay: it has no dates.
alter table public.trip_stops
  add constraint trip_stops_origin_without_dates
    check (kind <> 'origin' or (arrives_on is null and departs_on is null));

-- One origin per trip: the route starts there and comes back to it.
create unique index trip_stops_one_origin_idx on public.trip_stops (trip_id) where kind = 'origin';

-- ---------------------------------------------------------------------------
-- Reordering skips the origin: it's always shown first, so swapping with it
-- would look like nothing happened. Same function otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.move_trip_stop(p_stop_id uuid, p_direction integer)
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

  -- The origin isn't moved.
  if v_stop.kind = 'origin' then
    return;
  end if;

  if p_direction = -1 then
    select * into v_neighbor from public.trip_stops
    where trip_id = v_stop.trip_id and position < v_stop.position and kind <> 'origin'
    order by position desc limit 1
    for update;
  else
    select * into v_neighbor from public.trip_stops
    where trip_id = v_stop.trip_id and position > v_stop.position and kind <> 'origin'
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

-- ---------------------------------------------------------------------------
-- Link previews list the trip's destinations, not home or connections.
-- ---------------------------------------------------------------------------
create or replace function public.trip_preview(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'trip_id', t.id,
    'trip_name', t.name,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'cities', c.cities,
    'has_cover', t.cover_image_path is not null,
    'version', left(md5(concat_ws('|', t.name, t.start_date, t.end_date, t.cover_image_path, c.cities::text)), 10)
  )
  from public.trips t
  cross join lateral (
    select coalesce(jsonb_agg(s.name order by s.position), '[]'::jsonb) as cities
    from (
      select name, position from public.trip_stops
      where trip_id = t.id and kind = 'destination'
      order by position limit 12
    ) s
  ) c
  where t.id = p_trip_id
$$;
