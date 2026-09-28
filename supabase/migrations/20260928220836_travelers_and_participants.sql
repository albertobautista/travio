-- Travelers (who is going) and activity participants (who does what).
-- Design rationale: docs/data-model.md, "Identity and access" and "Participation".
--
-- travelers is NOT authorization: a traveler needs no account. trip_members
-- (who can see/edit the trip) and travelers (who is going) only meet through
-- the optional travelers.user_id link.

-- ---------------------------------------------------------------------------
-- travelers
-- ---------------------------------------------------------------------------
create table public.travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- Optional link to a Travio account; must be a member of this trip (trigger below).
  user_id uuid references public.profiles (id) on delete set null,
  -- Avatar color for travelers without a photo.
  color text not null default 'blue' check (color in ('blue', 'green', 'orange', 'purple', 'pink', 'teal')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travelers_trip_id_id_key unique (trip_id, id),
  -- An account is at most one traveler per trip.
  constraint travelers_one_per_user unique (trip_id, user_id)
);

create trigger travelers_set_updated_at
  before update on public.travelers
  for each row execute function public.set_updated_at();

-- A traveler can only be linked to someone who has access to the trip.
-- Without this, an editor could attach any account id to their trip.
create function public.check_traveler_user_is_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.trip_members
    where trip_id = new.trip_id and user_id = new.user_id
  ) then
    raise exception 'A traveler can only be linked to a member of the trip' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger travelers_check_user_is_member
  before insert or update of user_id on public.travelers
  for each row execute function public.check_traveler_user_is_member();

-- When someone loses access to a trip, their traveler stays (they may still
-- be going) but is no longer linked to their account.
-- security definer: a member leaving the trip may be a viewer, who can't
-- update travelers under RLS.
create function public.unlink_traveler_on_member_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.travelers set user_id = null
  where trip_id = old.trip_id and user_id = old.user_id;
  return old;
end;
$$;

create trigger trip_members_unlink_traveler
  after delete on public.trip_members
  for each row execute function public.unlink_traveler_on_member_removal();

-- The creator of a trip is its first traveler, linked to their account.
-- Runs after trips_add_creator_as_owner (triggers fire in name order), so the
-- membership check above passes. security definer for the same reason as the
-- owner trigger: the creator isn't a member yet when RLS would check.
create function public.add_trip_creator_as_traveler()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.travelers (trip_id, name, user_id, color, created_by)
    select new.id, coalesce(nullif(btrim(p.display_name), ''), 'Yo'), p.id, 'blue', p.id
    from public.profiles p
    where p.id = new.created_by;
  end if;
  return new;
end;
$$;

create trigger trips_add_creator_as_traveler
  after insert on public.trips
  for each row execute function public.add_trip_creator_as_traveler();

-- Existing trips: add their owner as a traveler too.
insert into public.travelers (trip_id, name, user_id, color, created_by)
select m.trip_id, coalesce(nullif(btrim(p.display_name), ''), 'Yo'), p.id, 'blue', p.id
from public.trip_members m
join public.profiles p on p.id = m.user_id
where m.role = 'owner'
  and not exists (select 1 from public.travelers t where t.trip_id = m.trip_id and t.user_id = m.user_id);

-- ---------------------------------------------------------------------------
-- activity_participants
--
-- NO ROWS FOR AN ACTIVITY MEANS "EVERYONE". Rows exist only when a subset of
-- the travelers takes part. trip_id is repeated here so both foreign keys can
-- be composite: the activity and the traveler must belong to the same trip.
-- ---------------------------------------------------------------------------
create table public.activity_participants (
  trip_id uuid not null,
  activity_id uuid not null,
  traveler_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, traveler_id),
  foreign key (trip_id, activity_id) references public.activities (trip_id, id) on delete cascade,
  foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete cascade
);

-- "Alberto's itinerary" and the traveler foreign key both look up by traveler.
create index activity_participants_traveler_idx on public.activity_participants (trip_id, traveler_id);

-- Replaces an activity's participants in one transaction and normalizes:
-- an empty list or every traveler of the trip is stored as no rows ("everyone").
-- security invoker: `for update` only finds the activity if the caller may
-- edit it, so viewers get "not found".
create function public.set_activity_participants(p_activity_id uuid, p_traveler_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_ids uuid[] := array(select distinct unnest(coalesce(p_traveler_ids, '{}')));
  v_trip_travelers integer;
begin
  select trip_id into v_trip_id from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  delete from public.activity_participants where activity_id = p_activity_id;

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
  insert into public.activity_participants (trip_id, activity_id, traveler_id)
  select v_trip_id, p_activity_id, unnest(v_ids);
end;
$$;

revoke execute on function public.set_activity_participants(uuid, uuid[]) from public, anon;
grant execute on function public.set_activity_participants(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members read, owners and editors write.
-- ---------------------------------------------------------------------------
alter table public.travelers enable row level security;
alter table public.activity_participants enable row level security;

create policy "travelers: members can read"
  on public.travelers for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "travelers: editors can add"
  on public.travelers for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "travelers: editors can update"
  on public.travelers for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "travelers: editors can delete"
  on public.travelers for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "activity_participants: members can read"
  on public.activity_participants for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "activity_participants: editors can add"
  on public.activity_participants for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "activity_participants: editors can delete"
  on public.activity_participants for delete to authenticated
  using (public.can_edit_trip(trip_id));
