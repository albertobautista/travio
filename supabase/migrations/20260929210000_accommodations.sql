-- Accommodations: where the travelers sleep. Design rationale:
-- docs/data-model.md (Itinerary > accommodations, 2.3 time, 2.7 booking status).
--
-- A first-class entity, not an activity: it spans nights, has a check-in and a
-- check-out, and Hoy needs "where am I sleeping tonight?" directly.
-- Check-in/check-out show up in the itinerary as derived events computed in
-- the app, not as duplicated activity rows.
--
-- Time model, same as activities: instants (timestamptz) plus the IANA zone of
-- the place, so "check-in 15:00" means 15:00 in that city.

create table public.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- The city it's in. Optional (a stop can be deleted), same-trip FK below.
  trip_stop_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  address text check (char_length(address) <= 300),
  -- Filled in once Google Places is integrated.
  google_place_id text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  check_in_at timestamptz not null,
  check_out_at timestamptz not null,
  timezone text not null check (public.is_valid_timezone(timezone)),
  booking_ref text check (char_length(booking_ref) <= 120),
  -- Only http(s): a "javascript:" URL rendered as a link would run code (XSS).
  booking_url text check (booking_url ~* '^https?://' and char_length(booking_url) <= 2000),
  booking_status text not null default 'planned' check (booking_status in ('planned', 'booked', 'confirmed')),
  cost_amount numeric(12, 2) check (cost_amount >= 0),
  cost_currency char(3) check (cost_currency ~ '^[A-Z]{3}$'),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accommodations_stay_order check (check_out_at > check_in_at),
  -- Up to 90 nights: catches typos like checking out a year later.
  constraint accommodations_stay_length check (check_out_at - check_in_at <= interval '90 days'),
  constraint accommodations_cost_has_currency check (cost_amount is null or cost_currency is not null),
  -- For children (participants, files) to reference (trip_id, id).
  constraint accommodations_trip_id_id_key unique (trip_id, id),
  constraint accommodations_stop_same_trip
    foreign key (trip_id, trip_stop_id) references public.trip_stops (trip_id, id)
    on delete set null (trip_stop_id)
);

-- Lists by stay order; Hoy looks for the stay that includes "now".
create index accommodations_trip_check_in_idx on public.accommodations (trip_id, check_in_at);
create index accommodations_trip_stop_idx on public.accommodations (trip_id, trip_stop_id);

create trigger accommodations_set_updated_at
  before update on public.accommodations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Same rule as activities: when a stop's time zone is corrected, keep its
-- accommodations at the same local check-in/check-out times.
-- ---------------------------------------------------------------------------
create function public.sync_accommodation_time_zones()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.accommodations
  set
    check_in_at = (check_in_at at time zone old.timezone) at time zone new.timezone,
    check_out_at = (check_out_at at time zone old.timezone) at time zone new.timezone,
    timezone = new.timezone
  where trip_id = new.trip_id
    and trip_stop_id = new.id
    and timezone = old.timezone;
  return new;
end;
$$;

create trigger trip_stops_sync_accommodation_time_zones
  after update of timezone on public.trip_stops
  for each row
  when (old.timezone is distinct from new.timezone)
  execute function public.sync_accommodation_time_zones();

-- ---------------------------------------------------------------------------
-- accommodation_participants: who stays there. Same rules as activities:
-- NO ROWS MEANS "EVERYONE"; rows only for a subset.
-- ---------------------------------------------------------------------------
create table public.accommodation_participants (
  trip_id uuid not null,
  accommodation_id uuid not null,
  traveler_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (accommodation_id, traveler_id),
  foreign key (trip_id, accommodation_id) references public.accommodations (trip_id, id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete cascade
);

create index accommodation_participants_traveler_idx on public.accommodation_participants (trip_id, traveler_id);

-- Replaces the participants in one transaction; an empty list or every
-- traveler is stored as no rows. security invoker: viewers get "not found".
create function public.set_accommodation_participants(p_accommodation_id uuid, p_traveler_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_ids uuid[] := array(select distinct unnest(coalesce(p_traveler_ids, '{}')));
  v_trip_travelers integer;
begin
  select trip_id into v_trip_id from public.accommodations where id = p_accommodation_id for update;
  if not found then
    raise exception 'Accommodation not found' using errcode = 'P0002';
  end if;

  delete from public.accommodation_participants where accommodation_id = p_accommodation_id;

  select count(*) into v_trip_travelers from public.travelers where trip_id = v_trip_id;
  if cardinality(v_ids) = 0 or (
    cardinality(v_ids) = v_trip_travelers
    and not exists (
      select 1 from unnest(v_ids) as selected(id)
      where not exists (select 1 from public.travelers t where t.trip_id = v_trip_id and t.id = selected.id)
    )
  ) then
    return; -- everyone
  end if;

  -- The composite foreign key rejects travelers from other trips.
  insert into public.accommodation_participants (trip_id, accommodation_id, traveler_id)
  select v_trip_id, p_accommodation_id, unnest(v_ids);
end;
$$;

revoke execute on function public.set_accommodation_participants(uuid, uuid[]) from public, anon;
grant execute on function public.set_accommodation_participants(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Files can now be attached to an accommodation (the reservation PDF).
-- Deleting the accommodation keeps the file as a trip document.
-- ---------------------------------------------------------------------------
alter table public.files
  add column accommodation_id uuid,
  add constraint files_accommodation_same_trip
    foreign key (trip_id, accommodation_id) references public.accommodations (trip_id, id)
    on delete set null (accommodation_id),
  -- A file belongs to at most one thing; none = a trip-level document.
  add constraint files_single_parent check (num_nonnulls(activity_id, accommodation_id) <= 1);

create index files_accommodation_idx on public.files (trip_id, accommodation_id) where accommodation_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.accommodations enable row level security;
alter table public.accommodation_participants enable row level security;

create policy "accommodations: members can read"
  on public.accommodations for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "accommodations: editors can add"
  on public.accommodations for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "accommodations: editors can update"
  on public.accommodations for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "accommodations: editors can delete"
  on public.accommodations for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "accommodation_participants: members can read"
  on public.accommodation_participants for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "accommodation_participants: editors can add"
  on public.accommodation_participants for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "accommodation_participants: editors can delete"
  on public.accommodation_participants for delete to authenticated
  using (public.can_edit_trip(trip_id));
