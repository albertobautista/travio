-- Transportation: flights, trains, buses, ferries, car rentals. Design
-- rationale: docs/data-model.md (Itinerary > transportations, 2.3 time).
--
-- Two time zones per row: a flight leaves London at 08:10 London time and
-- lands in Krakow at 11:30 Krakow time. Each end stores its instant plus the
-- IANA zone of that place, so both are shown in local time.
--
-- Origin and destination are free text (often an airport or station, not a
-- trip stop). The form offers the trip's cities as shortcuts that fill in the
-- name and zone.

create table public.transportations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null default 'other'
    check (type in ('flight', 'train', 'bus', 'ferry', 'car_rental', 'other')),
  origin_name text not null check (char_length(btrim(origin_name)) between 1 and 160),
  destination_name text not null check (char_length(btrim(destination_name)) between 1 and 160),
  -- Filled in once Google Places is integrated.
  origin_place_id text,
  destination_place_id text,
  departs_at timestamptz not null,
  departs_timezone text not null check (public.is_valid_timezone(departs_timezone)),
  arrives_at timestamptz not null,
  arrives_timezone text not null check (public.is_valid_timezone(arrives_timezone)),
  carrier text check (char_length(carrier) <= 120),
  service_number text check (char_length(service_number) <= 40),
  booking_ref text check (char_length(booking_ref) <= 120),
  -- Only http(s): a "javascript:" URL rendered as a link would run code (XSS).
  booking_url text check (booking_url ~* '^https?://' and char_length(booking_url) <= 2000),
  booking_status text not null default 'planned' check (booking_status in ('planned', 'booked', 'confirmed')),
  -- "Terminal 5 · puerta B32", "Andén 4 · coche 7".
  departure_detail text check (char_length(departure_detail) <= 160),
  arrival_detail text check (char_length(arrival_detail) <= 160),
  cost_amount numeric(12, 2) check (cost_amount >= 0),
  cost_currency char(3) check (cost_currency ~ '^[A-Z]{3}$'),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transportations_order check (arrives_at > departs_at),
  -- Long enough for a car rental; catches typos like arriving a year later.
  constraint transportations_length check (arrives_at - departs_at <= interval '90 days'),
  constraint transportations_cost_has_currency check (cost_amount is null or cost_currency is not null),
  constraint transportations_trip_id_id_key unique (trip_id, id)
);

create index transportations_trip_departs_idx on public.transportations (trip_id, departs_at);

create trigger transportations_set_updated_at
  before update on public.transportations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transportation_participants: who travels, and their seat. The seat lives
-- here because it belongs to the person, not the flight.
-- Same rule as activities: NO ROWS MEANS "EVERYONE" (and then no seats).
-- ---------------------------------------------------------------------------
create table public.transportation_participants (
  trip_id uuid not null,
  transportation_id uuid not null,
  traveler_id uuid not null,
  seat text check (char_length(seat) <= 20),
  created_at timestamptz not null default now(),
  primary key (transportation_id, traveler_id),
  foreign key (trip_id, transportation_id) references public.transportations (trip_id, id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete cascade
);

create index transportation_participants_traveler_idx on public.transportation_participants (trip_id, traveler_id);

-- Replaces who travels (and their seats) in one transaction.
-- p_travelers: [{"traveler_id": "...", "seat": "14A"}, ...]
--
-- "Everyone" is stored as no rows, like activities, but only when nobody has
-- a seat: seats need rows, so every traveler with a seat is kept as a row.
-- security invoker: `for update` only finds the row if the caller may edit it.
create function public.set_transportation_participants(p_transportation_id uuid, p_travelers jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_ids uuid[];
  v_seats text[];
  v_trip_travelers integer;
begin
  select trip_id into v_trip_id from public.transportations where id = p_transportation_id for update;
  if not found then
    raise exception 'Transportation not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(coalesce(p_travelers, '[]'::jsonb)) <> 'array' then
    raise exception 'p_travelers must be a JSON array' using errcode = '22023';
  end if;

  -- One entry per traveler (the first wins); blank seats become null.
  select coalesce(array_agg(id order by id), '{}'), coalesce(array_agg(seat order by id), '{}')
  into v_ids, v_seats
  from (
    select distinct on ((t ->> 'traveler_id')::uuid)
      (t ->> 'traveler_id')::uuid as id,
      nullif(btrim(t ->> 'seat'), '') as seat
    from jsonb_array_elements(coalesce(p_travelers, '[]'::jsonb)) as t
  ) selected;

  delete from public.transportation_participants where transportation_id = p_transportation_id;

  select count(*) into v_trip_travelers from public.travelers where trip_id = v_trip_id;
  if cardinality(v_ids) = 0 or (
    not exists (select 1 from unnest(v_seats) as s where s is not null) -- nobody has a seat
    and cardinality(v_ids) = v_trip_travelers
    and not exists (
      select 1 from unnest(v_ids) as selected(id)
      where not exists (select 1 from public.travelers t where t.trip_id = v_trip_id and t.id = selected.id)
    )
  ) then
    return; -- everyone, no seats
  end if;

  -- The composite foreign key rejects travelers from other trips.
  insert into public.transportation_participants (trip_id, transportation_id, traveler_id, seat)
  select v_trip_id, p_transportation_id, id, seat
  from unnest(v_ids, v_seats) as u(id, seat);
end;
$$;

revoke execute on function public.set_transportation_participants(uuid, jsonb) from public, anon;
grant execute on function public.set_transportation_participants(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Tickets and boarding passes attach to a transportation.
-- ---------------------------------------------------------------------------
alter table public.files
  add column transportation_id uuid,
  add constraint files_transportation_same_trip
    foreign key (trip_id, transportation_id) references public.transportations (trip_id, id)
    on delete set null (transportation_id),
  drop constraint files_single_parent,
  add constraint files_single_parent check (num_nonnulls(activity_id, accommodation_id, transportation_id) <= 1);

create index files_transportation_idx on public.files (trip_id, transportation_id) where transportation_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.transportations enable row level security;
alter table public.transportation_participants enable row level security;

create policy "transportations: members can read"
  on public.transportations for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "transportations: editors can add"
  on public.transportations for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "transportations: editors can update"
  on public.transportations for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "transportations: editors can delete"
  on public.transportations for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "transportation_participants: members can read"
  on public.transportation_participants for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "transportation_participants: editors can add"
  on public.transportation_participants for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "transportation_participants: editors can delete"
  on public.transportation_participants for delete to authenticated
  using (public.can_edit_trip(trip_id));
