-- Group links (2026-10-20): one link the owner can drop in a WhatsApp group.
-- Unlike an invitation (trip_invitations: one person, used once), a group
-- link is used by many people, and nobody joins just by having it: they ask
-- to join and the owner approves each request. Decided with Alberto: a
-- forwarded message reaches people nobody invited, and even a viewer sees
-- tickets and bookings.
--
--   * One group link per trip. Creating a new one replaces the old one, whose
--     link stops working. Deleting it is "revoke".
--   * Same token scheme as invitations: 32 random bytes, shown once, only
--     sha256(token) stored (invitation_token_hash).
--   * It expires (1, 7 or 30 days) and may cap how many people it lets in.
--   * Asking to join stores a trip_join_requests row. The owner decides the
--     access (viewer by default) and whether the person travels: no
--     traveler, an existing traveler without an account, or a new one.
--     Never automatic, because a new traveler joins everything that's for
--     "everyone" (participants, expense splits).
--
-- Requesters aren't members, so RLS would hide everything from them: they go
-- through security definer functions that check everything themselves, like
-- the invitation functions.

create table public.trip_group_links (
  id uuid primary key default gen_random_uuid(),
  -- unique: one group link per trip.
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  token_hash bytea not null unique,
  -- Null: no cap. Counts approved requests made through this link.
  max_members int check (max_members between 1 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- For the composite foreign key below.
  unique (trip_id, id)
);

create trigger trip_group_links_set_updated_at
  before update on public.trip_group_links
  for each row execute function public.set_updated_at();

create table public.trip_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- The link it came through. Set null when that link is replaced or
  -- revoked: pending requests stay for the owner to decide.
  link_id uuid,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot at request time, so the owner knows who's asking: they aren't a
  -- member, so the owner can't read their profile (profiles RLS).
  name text not null check (char_length(name) between 1 and 120),
  email text,
  avatar_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One request per person and trip: asking twice doesn't add rows.
  unique (trip_id, user_id),
  foreign key (trip_id, link_id) references public.trip_group_links (trip_id, id) on delete set null (link_id)
);

create index trip_join_requests_link_id_idx on public.trip_join_requests (link_id);

create trigger trip_join_requests_set_updated_at
  before update on public.trip_join_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS. Group links: only the owner sees and manages them (no update policy:
-- a link is never edited, only replaced or deleted).
-- Join requests: the owner sees their trip's, each person sees their own.
-- Nobody writes them directly: request_to_join_trip and decide_join_request
-- do, as definer functions.
-- ---------------------------------------------------------------------------
alter table public.trip_group_links enable row level security;
alter table public.trip_join_requests enable row level security;

create policy "trip_group_links: owner reads"
  on public.trip_group_links for select to authenticated
  using (public.trip_role(trip_id) = 'owner');

create policy "trip_group_links: owner creates"
  on public.trip_group_links for insert to authenticated
  with check (public.trip_role(trip_id) = 'owner' and created_by = (select auth.uid()));

create policy "trip_group_links: owner deletes"
  on public.trip_group_links for delete to authenticated
  using (public.trip_role(trip_id) = 'owner');

create policy "trip_join_requests: owner or requester reads"
  on public.trip_join_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.trip_role(trip_id) = 'owner');

-- ---------------------------------------------------------------------------
-- create_trip_group_link: returns the token, the only time it exists in
-- clear. security invoker: the delete and insert go through the owner-only
-- policies above.
-- ---------------------------------------------------------------------------
create function public.create_trip_group_link(p_trip_id uuid, p_days int default 7, p_max_members int default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_token text;
  v_row public.trip_group_links;
begin
  if p_days is null or p_days not in (1, 7, 30) then
    raise exception 'A group link lasts 1, 7 or 30 days' using errcode = '22023';
  end if;

  -- The old link (if any) stops working. Its pending requests stay.
  delete from public.trip_group_links where trip_id = p_trip_id;

  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');

  insert into public.trip_group_links (trip_id, token_hash, max_members, expires_at)
  values (p_trip_id, public.invitation_token_hash(v_token), p_max_members, now() + make_interval(days => p_days))
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'token', v_token, 'expires_at', v_row.expires_at);
end;
$$;

-- How many people a link has let in so far.
create function public.group_link_approved_count(p_link_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select count(*)::int from public.trip_join_requests where link_id = p_link_id and status = 'approved'
$$;

-- ---------------------------------------------------------------------------
-- get_trip_group_link: what the /unirse page shows. Callable signed out.
--
-- Signed out it reveals only the trip's name and dates and who shares the
-- link, like get_trip_invitation. Signed in, the status also says where the
-- caller stands.
--
-- status: valid | expired | full | member | pending | rejected.
-- Returns null for an unknown, replaced or revoked token.
-- ---------------------------------------------------------------------------
create function public.get_trip_group_link(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.trip_group_links;
  v_uid uuid := auth.uid();
  v_request public.trip_join_requests;
  v_status text;
begin
  select * into v_link
  from public.trip_group_links
  where token_hash = public.invitation_token_hash(p_token);
  if not found then
    return null;
  end if;

  if v_uid is not null then
    select * into v_request from public.trip_join_requests where trip_id = v_link.trip_id and user_id = v_uid;
  end if;

  v_status := case
    when v_uid is not null and exists (
      select 1 from public.trip_members where trip_id = v_link.trip_id and user_id = v_uid
    ) then 'member'
    when v_request.status = 'pending' then 'pending'
    -- A "no" counts for the link it was given on; a new link may ask again.
    when v_request.status = 'rejected' and v_request.link_id = v_link.id then 'rejected'
    when v_link.expires_at <= now() then 'expired'
    when v_link.max_members is not null and public.group_link_approved_count(v_link.id) >= v_link.max_members then 'full'
    else 'valid'
  end;

  return (
    select jsonb_build_object(
      'status', v_status,
      'trip_id', t.id,
      'trip_name', t.name,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'expires_at', v_link.expires_at,
      'inviter_name', (select display_name from public.profiles where id = v_link.created_by)
    )
    from public.trips t
    where t.id = v_link.trip_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- request_to_join_trip: "Pedir unirme". Always an explicit click on the page
-- (chat apps open links on their own to build previews).
--
-- Returns { status, trip_id?, request_id?, owner_id? }:
--   requested (new or renewed request), pending (already asked), member,
--   rejected, expired, full, too_many, not_found. Nothing changes unless the
--   status is "requested".
-- ---------------------------------------------------------------------------
create function public.request_to_join_trip(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.trip_group_links;
  v_request public.trip_join_requests;
  v_name text;
  v_avatar text;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Lock the link: the cap and the pending limit are checked and used in one go.
  select * into v_link
  from public.trip_group_links
  where token_hash = public.invitation_token_hash(p_token)
  for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (select 1 from public.trip_members where trip_id = v_link.trip_id and user_id = v_uid) then
    return jsonb_build_object('status', 'member', 'trip_id', v_link.trip_id);
  end if;

  select * into v_request from public.trip_join_requests where trip_id = v_link.trip_id and user_id = v_uid;
  if v_request.status = 'pending' then
    return jsonb_build_object('status', 'pending', 'trip_id', v_link.trip_id);
  end if;
  if v_request.status = 'rejected' and v_request.link_id = v_link.id then
    return jsonb_build_object('status', 'rejected');
  end if;

  if v_link.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_link.max_members is not null and public.group_link_approved_count(v_link.id) >= v_link.max_members then
    return jsonb_build_object('status', 'full');
  end if;
  -- Abuse limit: a leaked link can't flood the owner with requests.
  if (select count(*) from public.trip_join_requests where trip_id = v_link.trip_id and status = 'pending') >= 50 then
    return jsonb_build_object('status', 'too_many');
  end if;

  select left(coalesce(nullif(btrim(display_name), ''), split_part(auth.jwt() ->> 'email', '@', 1), 'Alguien'), 120), avatar_url
  into v_name, v_avatar
  from public.profiles where id = v_uid;

  -- A new request, or a renewed one: rejected on an older link, or approved
  -- before and removed from the trip since. The owner decides again.
  insert into public.trip_join_requests as r (trip_id, link_id, user_id, name, email, avatar_url)
  values (v_link.trip_id, v_link.id, v_uid, coalesce(v_name, 'Alguien'), auth.jwt() ->> 'email', v_avatar)
  on conflict (trip_id, user_id) do update
    set link_id = excluded.link_id,
        name = excluded.name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        status = 'pending',
        decided_by = null,
        decided_at = null,
        created_at = now()
  returning * into v_request;

  return jsonb_build_object(
    'status', 'requested',
    'trip_id', v_link.trip_id,
    'request_id', v_request.id,
    'owner_id', (select user_id from public.trip_members where trip_id = v_link.trip_id and role = 'owner')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- decide_join_request: the owner approves or rejects. Approving adds the
-- member with the chosen role and, if the owner says so, links them to an
-- existing traveler without an account or adds them as a new traveler (same
-- as accept_trip_invitation).
--
-- Returns { status: approved | rejected | decided | full, user_id?, trip_id? }.
-- "decided": someone already decided it (two tabs open). "full": approving
-- would go over the link's cap.
-- ---------------------------------------------------------------------------
create function public.decide_join_request(
  p_request_id uuid,
  p_approve boolean,
  p_role text default 'viewer',
  p_traveler_id uuid default null,
  p_adds_traveler boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.trip_join_requests;
  v_link public.trip_group_links;
  v_color text;
begin
  select * into v_request from public.trip_join_requests where id = p_request_id for update;
  -- Not found and not the owner look the same: nothing to reveal.
  if not found or public.trip_role(v_request.trip_id) is distinct from 'owner' then
    raise exception 'Only the trip owner can decide join requests' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    return jsonb_build_object('status', 'decided');
  end if;

  if not coalesce(p_approve, false) then
    update public.trip_join_requests
    set status = 'rejected', decided_by = v_uid, decided_at = now()
    where id = v_request.id;
    return jsonb_build_object('status', 'rejected', 'trip_id', v_request.trip_id, 'user_id', v_request.user_id);
  end if;

  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer' using errcode = '22023';
  end if;
  if p_traveler_id is not null and coalesce(p_adds_traveler, false) then
    raise exception 'Either an existing traveler or a new one' using errcode = '22023';
  end if;

  -- The cap, if the request's link still exists. Locked so two approvals at
  -- once can't both take the last place.
  if v_request.link_id is not null then
    select * into v_link from public.trip_group_links where id = v_request.link_id for update;
    if v_link.max_members is not null and public.group_link_approved_count(v_link.id) >= v_link.max_members then
      return jsonb_build_object('status', 'full');
    end if;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_request.trip_id, v_request.user_id, p_role)
  on conflict do nothing;

  -- After the insert, so the "linked user must be a member" trigger passes.
  if p_traveler_id is not null then
    update public.travelers set user_id = v_request.user_id
    where id = p_traveler_id and trip_id = v_request.trip_id and user_id is null;
    if not found then
      raise exception 'That traveler already has an account or is not in this trip' using errcode = '23505';
    end if;
  elsif coalesce(p_adds_traveler, false) and not exists (
    select 1 from public.travelers where trip_id = v_request.trip_id and user_id = v_request.user_id
  ) then
    -- The least used color, like nextTravelerColor in src/lib/travelers/colors.ts.
    select c.color into v_color
    from unnest(array['blue', 'green', 'orange', 'purple', 'pink', 'teal']) with ordinality as c (color, pos)
    left join public.travelers tr on tr.trip_id = v_request.trip_id and tr.color = c.color
    group by c.color, c.pos
    order by count(tr.id), c.pos
    limit 1;

    insert into public.travelers (trip_id, name, user_id, color, created_by)
    values (v_request.trip_id, left(v_request.name, 80), v_request.user_id, v_color, v_uid);
  end if;

  update public.trip_join_requests
  set status = 'approved', decided_by = v_uid, decided_at = now()
  where id = v_request.id;

  return jsonb_build_object('status', 'approved', 'trip_id', v_request.trip_id, 'user_id', v_request.user_id, 'role', p_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. get_trip_group_link is callable signed out, like get_trip_invitation.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.create_trip_group_link(uuid, int, int),
  public.group_link_approved_count(uuid),
  public.get_trip_group_link(text),
  public.request_to_join_trip(text),
  public.decide_join_request(uuid, boolean, text, uuid, boolean)
from public, anon;

grant execute on function
  public.create_trip_group_link(uuid, int, int),
  public.group_link_approved_count(uuid),
  public.get_trip_group_link(text),
  public.request_to_join_trip(text),
  public.decide_join_request(uuid, boolean, text, uuid, boolean)
to authenticated;

grant execute on function public.get_trip_group_link(text) to anon;
