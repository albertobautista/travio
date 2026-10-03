-- Invitations: the trip's owner shares a link; whoever opens it and signs in
-- (with an existing account or a new one) joins the trip with the invitation's
-- role. Decided 2026-10-03: owner only, link only (no email yet), a minimal
-- preview before signing in, single use, valid for 7 days.
--
-- How the token works, like a password:
--   * create_trip_invitation makes 32 random bytes and returns them once,
--     base64url-encoded, to build the link /invitacion/<token>.
--   * The table stores only sha256(token). Someone who can read the table
--     (a backup, a leaked dump) still can't use an invitation.
--   * Every lookup hashes the token it's given and compares hashes.
--
-- Invitees never touch the table: they aren't members yet, so RLS would hide
-- every row. They go through two security definer functions that check
-- everything themselves (get_trip_invitation, accept_trip_invitation).

create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash bytea not null unique,
  role text not null check (role in ('editor', 'viewer')),
  -- Optional: who this invitation is for. Accepting links that traveler to the
  -- new member's account. If the traveler is deleted, the invitation stays.
  traveler_id uuid,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite: the traveler must belong to the same trip.
  foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete set null (traveler_id)
);

create index trip_invitations_trip_id_idx on public.trip_invitations (trip_id);

create trigger trip_invitations_set_updated_at
  before update on public.trip_invitations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: only the owner sees and manages a trip's invitations.
-- No update policy: an invitation is never edited, only created, accepted (by
-- the definer function) or deleted. Deleting a pending one is "revoke".
-- ---------------------------------------------------------------------------
alter table public.trip_invitations enable row level security;

create policy "trip_invitations: owner reads"
  on public.trip_invitations for select to authenticated
  using (public.trip_role(trip_id) = 'owner');

create policy "trip_invitations: owner creates"
  on public.trip_invitations for insert to authenticated
  with check (
    public.trip_role(trip_id) = 'owner'
    and created_by = (select auth.uid())
    and accepted_by is null
    and accepted_at is null
  );

create policy "trip_invitations: owner deletes"
  on public.trip_invitations for delete to authenticated
  using (public.trip_role(trip_id) = 'owner');

-- ---------------------------------------------------------------------------
-- sha256 of the token as the app sends it. Built in to Postgres (no pgcrypto).
-- ---------------------------------------------------------------------------
create function public.invitation_token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(btrim(p_token), 'UTF8'))
$$;

-- ---------------------------------------------------------------------------
-- create_trip_invitation: returns the token, the only time it exists in clear.
--
-- security invoker on purpose: the insert goes through the RLS policy above,
-- so a non-owner simply can't create one. If the invitation is for a traveler,
-- older pending invitations for that same traveler are deleted, so only the
-- newest link works.
-- ---------------------------------------------------------------------------
create function public.create_trip_invitation(p_trip_id uuid, p_role text, p_traveler_id uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_token text;
  v_row public.trip_invitations;
begin
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer' using errcode = '22023';
  end if;

  if p_traveler_id is not null and exists (
    select 1 from public.travelers
    where id = p_traveler_id and trip_id = p_trip_id and user_id is not null
  ) then
    raise exception 'That traveler already has an account' using errcode = '23505';
  end if;

  -- 32 random bytes as base64url (43 characters, safe in a URL path).
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');

  insert into public.trip_invitations (trip_id, token_hash, role, traveler_id)
  values (p_trip_id, public.invitation_token_hash(v_token), p_role, p_traveler_id)
  returning * into v_row;

  if p_traveler_id is not null then
    delete from public.trip_invitations
    where trip_id = p_trip_id
      and traveler_id = p_traveler_id
      and accepted_at is null
      and id <> v_row.id;
  end if;

  return jsonb_build_object('id', v_row.id, 'token', v_token, 'expires_at', v_row.expires_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_trip_invitation: what the invitation page shows. Callable signed out.
--
-- Signed out it reveals only what the invitee needs to decide: trip name and
-- dates, who invites, the role and the traveler it's for. Nothing about the
-- itinerary, stays or documents. Signed in, it also lists the travelers
-- without an account, for "¿Quién eres en este viaje?".
--
-- status: valid | expired | used | member (the caller already has access).
-- Returns null for an unknown or revoked token: both mean "this link doesn't
-- work", and a deleted invitation leaves nothing to tell them apart.
-- ---------------------------------------------------------------------------
create function public.get_trip_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.trip_invitations;
  v_uid uuid := auth.uid();
  v_status text;
begin
  select * into v_inv
  from public.trip_invitations
  where token_hash = public.invitation_token_hash(p_token);
  if not found then
    return null;
  end if;

  v_status := case
    when v_uid is not null and exists (
      select 1 from public.trip_members where trip_id = v_inv.trip_id and user_id = v_uid
    ) then 'member'
    when v_inv.accepted_at is not null then 'used'
    when v_inv.expires_at <= now() then 'expired'
    else 'valid'
  end;

  return (
    select jsonb_build_object(
      'status', v_status,
      'trip_id', t.id,
      'trip_name', t.name,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'role', v_inv.role,
      'expires_at', v_inv.expires_at,
      'inviter_name', (select display_name from public.profiles where id = v_inv.created_by),
      'traveler_name', (
        select name from public.travelers where id = v_inv.traveler_id and user_id is null
      ),
      'unlinked_travelers', case
        when v_uid is not null and v_status = 'valid' and v_inv.traveler_id is null then coalesce((
          select jsonb_agg(jsonb_build_object('id', tr.id, 'name', tr.name, 'color', tr.color) order by tr.created_at)
          from public.travelers tr
          where tr.trip_id = t.id and tr.user_id is null
        ), '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    from public.trips t
    where t.id = v_inv.trip_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_trip_invitation: joins the trip. Always an explicit click on the
-- page, never on opening the link: chat apps open links by themselves to
-- build previews, and that must not use up a single-use invitation.
--
-- p_traveler_id is who the person says they are, when the invitation wasn't
-- made for a specific traveler. Null means "I'm not travelling, just looking".
--
-- Returns { status, trip_id }. Expected outcomes (expired, used, already a
-- member) are returned rather than raised; nothing has changed by then.
-- ---------------------------------------------------------------------------
create function public.accept_trip_invitation(p_token text, p_traveler_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.trip_invitations;
  v_traveler_id uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Lock the row: two people clicking the same link at once can't both join.
  select * into v_inv
  from public.trip_invitations
  where token_hash = public.invitation_token_hash(p_token)
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Someone who already has access keeps their role, and the invitation stays
  -- unused (it may have been forwarded to them by mistake).
  if exists (select 1 from public.trip_members where trip_id = v_inv.trip_id and user_id = v_uid) then
    return jsonb_build_object('status', 'member', 'trip_id', v_inv.trip_id);
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if v_inv.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  -- Which traveler to link: the one the invitation names, else the one picked.
  -- Only travelers of this trip that aren't linked to anyone yet; if that
  -- changed in the meantime, join without linking rather than fail.
  select id into v_traveler_id
  from public.travelers
  where trip_id = v_inv.trip_id
    and user_id is null
    and id = coalesce(v_inv.traveler_id, p_traveler_id);

  insert into public.trip_members (trip_id, user_id, role)
  values (v_inv.trip_id, v_uid, v_inv.role);

  -- After the insert, so the "linked user must be a member" trigger passes.
  if v_traveler_id is not null then
    update public.travelers set user_id = v_uid where id = v_traveler_id;
  end if;

  update public.trip_invitations
  set accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return jsonb_build_object('status', 'joined', 'trip_id', v_inv.trip_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Functions are executable by everyone by default.
-- get_trip_invitation is the only thing in the schema `anon` may call: the
-- invitation page shows a preview before signing in.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.invitation_token_hash(text),
  public.create_trip_invitation(uuid, text, uuid),
  public.get_trip_invitation(text),
  public.accept_trip_invitation(text, uuid)
from public, anon;

-- invitation_token_hash too: create_trip_invitation runs as the caller.
grant execute on function
  public.invitation_token_hash(text),
  public.create_trip_invitation(uuid, text, uuid),
  public.get_trip_invitation(text),
  public.accept_trip_invitation(text, uuid)
to authenticated;

grant execute on function public.get_trip_invitation(text) to anon;
