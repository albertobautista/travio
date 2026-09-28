-- Travio: first vertical slice of the schema.
-- profiles, trips and trip_members, plus the helper functions and RLS policies
-- every later trip-owned table will reuse. Design rationale: docs/data-model.md.

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every update.
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user (auth.users is managed by Supabase).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile automatically on sign-up. Google puts the name and photo in
-- raw_user_meta_data; email/password sign-ups may have neither.
-- security definer: the trigger runs as the table owner, because the new user
-- has no insert policy on profiles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  -- Dates are optional: a trip can be created before they are known.
  start_date date,
  end_date date,
  -- A path inside Supabase Storage, never a public URL.
  cover_image_path text,
  currency char(3) not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  budget_amount numeric(12, 2) check (budget_amount >= 0),
  -- set null: deleting the creator's account must not be blocked by (or delete) the trip.
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_in_order check (end_date >= start_date)
);

create index trips_created_by_idx on public.trips (created_by);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- trip_members: who (an authenticated user) can do what on a trip.
-- Not to be confused with travelers (who is going), which comes later.
-- ---------------------------------------------------------------------------
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- Exactly one owner per trip.
create unique index trip_members_one_owner_per_trip
  on public.trip_members (trip_id)
  where role = 'owner';

-- "Which trips am I in?" (the primary key already covers lookups by trip_id).
create index trip_members_user_id_idx on public.trip_members (user_id);

create trigger trip_members_set_updated_at
  before update on public.trip_members
  for each row execute function public.set_updated_at();

-- The creator of a trip becomes its owner.
-- security definer: the creator is not a member yet, so the trip_members insert
-- policy (owner only) would reject this row.
create function public.add_trip_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger trips_add_creator_as_owner
  after insert on public.trips
  for each row execute function public.add_trip_creator_as_owner();

-- ---------------------------------------------------------------------------
-- Authorization helpers used by RLS policies.
--
-- trip_role is security definer so that policies ON trip_members can ask
-- "what is my role in this trip?" without re-applying trip_members' own RLS,
-- which would recurse forever. It only ever reveals the caller's own role.
-- ---------------------------------------------------------------------------
create function public.trip_role(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tm.role
  from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.user_id = (select auth.uid())
$$;

create function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.trip_role(p_trip_id) is not null
$$;

create function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.trip_role(p_trip_id) in ('owner', 'editor'), false)
$$;

-- Can the caller see this other user's profile? Yes if they share a trip.
create function public.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  )
$$;

-- Functions are executable by everyone by default; only signed-in users need these.
revoke execute on function
  public.trip_role(uuid),
  public.is_trip_member(uuid),
  public.can_edit_trip(uuid),
  public.shares_trip_with(uuid)
from public, anon;

grant execute on function
  public.trip_role(uuid),
  public.is_trip_member(uuid),
  public.can_edit_trip(uuid),
  public.shares_trip_with(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Ownership transfer: the only way to change who the owner is.
-- Demotes first, then promotes, so the one-owner index is never violated.
-- ---------------------------------------------------------------------------
create function public.transfer_trip_ownership(p_trip_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Lock the owner row so two concurrent transfers can't interleave.
  perform 1
  from public.trip_members
  where trip_id = p_trip_id and user_id = v_caller and role = 'owner'
  for update;

  if not found then
    raise exception 'Only the trip owner can transfer ownership' using errcode = '42501';
  end if;

  if p_new_owner_id = v_caller then
    raise exception 'You already own this trip' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must already be a member of the trip' using errcode = '22023';
  end if;

  update public.trip_members set role = 'editor'
  where trip_id = p_trip_id and user_id = v_caller;

  update public.trip_members set role = 'owner'
  where trip_id = p_trip_id and user_id = p_new_owner_id;
end;
$$;

revoke execute on function public.transfer_trip_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_trip_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- With RLS enabled and no matching policy, a row is invisible / the write fails.
-- Every policy targets `authenticated`; `anon` gets nothing.
-- `(select auth.uid())` is evaluated once per query instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

-- profiles: see yourself and people you share a trip with; edit only yourself.
-- No insert/delete policies: rows are created by the sign-up trigger and
-- removed when the auth user is deleted.
create policy "profiles: read own and trip mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_trip_with(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- trips
-- The created_by clause matters on create: `insert ... returning` checks this
-- select policy, and the owner membership added by the trigger may not be
-- visible to that check yet.
create policy "trips: members can read"
  on public.trips for select to authenticated
  using (created_by = (select auth.uid()) or public.is_trip_member(id));

create policy "trips: signed-in users can create their own"
  on public.trips for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "trips: owners and editors can update"
  on public.trips for update to authenticated
  using (public.can_edit_trip(id))
  with check (public.can_edit_trip(id));

create policy "trips: only the owner can delete"
  on public.trips for delete to authenticated
  using (public.trip_role(id) = 'owner');

-- trip_members
-- Nobody can create, grant or remove the owner role through these policies:
-- the owner row comes from the creation trigger and changes only through
-- transfer_trip_ownership.
create policy "trip_members: members can read the member list"
  on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "trip_members: owner adds editors and viewers"
  on public.trip_members for insert to authenticated
  with check (public.trip_role(trip_id) = 'owner' and role <> 'owner');

create policy "trip_members: owner changes other members' roles"
  on public.trip_members for update to authenticated
  using (public.trip_role(trip_id) = 'owner' and role <> 'owner')
  with check (role <> 'owner');

create policy "trip_members: owner removes members, members can leave"
  on public.trip_members for delete to authenticated
  using (
    role <> 'owner'
    and (public.trip_role(trip_id) = 'owner' or user_id = (select auth.uid()))
  );
