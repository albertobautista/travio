-- Ordering the route, two changes:
--
-- 1. Drag and drop: reorder_trip_stops sets the whole order at once (the ↑/↓
--    buttons keep using move_trip_stop, one swap at a time).
-- 2. New cities go before the way home: a connection after the last
--    destination is the return leg (London -> Mexico City -> home), so a new
--    destination is placed before it instead of after it.

-- ---------------------------------------------------------------------------
-- New stops: at the end, but a new destination goes before the trailing
-- connections (the return). With no destination yet, trailing connections are
-- the way out (home -> Mexico City -> ...), so the new city still goes last.
-- ---------------------------------------------------------------------------
create or replace function public.set_trip_stop_position()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_return integer;
begin
  if new.kind = 'destination' then
    select min(position) into v_return
    from public.trip_stops
    where trip_id = new.trip_id
      and kind = 'transit'
      and position > (
        select max(position) from public.trip_stops
        where trip_id = new.trip_id and kind = 'destination'
      );
  end if;

  if v_return is null then
    select coalesce(max(position), 0) + 1 into new.position
    from public.trip_stops
    where trip_id = new.trip_id;
  else
    -- Make room: the return connections (and anything after them) move one
    -- place down. One statement, so the unique check runs once at its end.
    update public.trip_stops set position = position + 1
    where trip_id = new.trip_id and position >= v_return;
    new.position := v_return;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reordering by drag and drop: the client sends every stop except the origin
-- (shown first anyway), in the new order. The stops keep the positions they
-- already had, only handed out in that order, so the origin's isn't touched.
--
-- Security invoker: locking the rows FOR UPDATE goes through the update
-- policy, so only owners and editors get past the first check.
-- ---------------------------------------------------------------------------
create function public.reorder_trip_stops(p_trip_id uuid, p_stop_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_locked integer;
begin
  with locked as (
    select id from public.trip_stops
    where trip_id = p_trip_id and kind <> 'origin'
    for update
  )
  select count(*) into v_locked from locked;

  if v_locked = 0 then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;

  -- Exactly the trip's stops (minus the origin), each once. A list made
  -- before someone else added or removed a city is refused, not half applied.
  if coalesce(cardinality(p_stop_ids), 0) <> v_locked
    or (select count(distinct id) from unnest(p_stop_ids) as u(id)) <> v_locked
    or exists (
      select 1 from unnest(p_stop_ids) as u(id)
      where not exists (
        select 1 from public.trip_stops s
        where s.id = u.id and s.trip_id = p_trip_id and s.kind <> 'origin'
      )
    )
  then
    raise exception 'The list does not match the trip''s stops' using errcode = '22023';
  end if;

  set constraints public.trip_stops_position_key deferred;
  with slots as (
    select position, row_number() over (order by position) as n
    from public.trip_stops
    where trip_id = p_trip_id and kind <> 'origin'
  ),
  wanted as (
    select id, ord from unnest(p_stop_ids) with ordinality as u(id, ord)
  )
  update public.trip_stops s
  set position = slots.position
  from wanted
  join slots on slots.n = wanted.ord
  where s.id = wanted.id and s.position <> slots.position;
end;
$$;

revoke execute on function public.reorder_trip_stops(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_trip_stops(uuid, uuid[]) to authenticated;
