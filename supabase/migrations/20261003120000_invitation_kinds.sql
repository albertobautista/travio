-- Invitations, revised 2026-10-03 after testing: the owner decides who the
-- invitation is for when creating it, and the invitee no longer picks
-- ("¿Quién eres?" let anyone with the link claim any traveler without an
-- account, and offered no way to join as a new traveler).
--
-- Three kinds of invitation:
--   * for an existing traveler  -> traveler_id set; accepting links it.
--   * for someone new who's travelling -> adds_traveler; accepting creates
--     their traveler with their account's name.
--   * just to follow the trip -> neither; no traveler.
--
-- Why adding a traveler is the owner's call: no participant rows means
-- "everyone", so a new traveler joins every activity, stay and leg without
-- participants and every expense split between everyone, which changes the
-- other travelers' balances.

alter table public.trip_invitations
  add column adds_traveler boolean not null default false,
  add constraint trip_invitations_one_kind check (not (adds_traveler and traveler_id is not null));

-- An invitation for a traveler who was deleted no longer makes sense: delete
-- it too (it was set null, which silently turned it into "just follow").
alter table public.trip_invitations
  drop constraint trip_invitations_trip_id_traveler_id_fkey,
  add constraint trip_invitations_trip_id_traveler_id_fkey
    foreign key (trip_id, traveler_id) references public.travelers (trip_id, id) on delete cascade;

-- ---------------------------------------------------------------------------
-- New signatures: drop the old functions instead of leaving overloads around.
-- ---------------------------------------------------------------------------
drop function public.create_trip_invitation(uuid, text, uuid);
drop function public.accept_trip_invitation(text, uuid);

create function public.create_trip_invitation(
  p_trip_id uuid,
  p_role text,
  p_traveler_id uuid default null,
  p_adds_traveler boolean default false
)
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

  -- RLS (owner only) and the one-kind check apply here.
  insert into public.trip_invitations (trip_id, token_hash, role, traveler_id, adds_traveler)
  values (p_trip_id, public.invitation_token_hash(v_token), p_role, p_traveler_id, coalesce(p_adds_traveler, false))
  returning * into v_row;

  -- Only the newest link for a given traveler works.
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

-- Same as before, minus unlinked_travelers and plus adds_traveler.
create or replace function public.get_trip_invitation(p_token text)
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
      'adds_traveler', v_inv.adds_traveler
    )
    from public.trips t
    where t.id = v_inv.trip_id
  );
end;
$$;

create function public.accept_trip_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.trip_invitations;
  v_name text;
  v_color text;
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

  insert into public.trip_members (trip_id, user_id, role)
  values (v_inv.trip_id, v_uid, v_inv.role);

  -- After the insert, so the "linked user must be a member" trigger passes.
  if v_inv.traveler_id is not null then
    -- If someone else got linked to that traveler meanwhile, join without
    -- linking rather than fail.
    update public.travelers set user_id = v_uid
    where id = v_inv.traveler_id and user_id is null;
  elsif v_inv.adds_traveler then
    select coalesce(nullif(btrim(display_name), ''), 'Invitado') into v_name
    from public.profiles where id = v_uid;

    -- The least used color, like nextTravelerColor in src/lib/travelers/colors.ts.
    select c.color into v_color
    from unnest(array['blue', 'green', 'orange', 'purple', 'pink', 'teal']) with ordinality as c (color, pos)
    left join public.travelers tr on tr.trip_id = v_inv.trip_id and tr.color = c.color
    group by c.color, c.pos
    order by count(tr.id), c.pos
    limit 1;

    insert into public.travelers (trip_id, name, user_id, color, created_by)
    values (v_inv.trip_id, left(coalesce(v_name, 'Invitado'), 80), v_uid, v_color, v_uid);
  end if;

  update public.trip_invitations
  set accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return jsonb_build_object('status', 'joined', 'trip_id', v_inv.trip_id);
end;
$$;

revoke execute on function
  public.create_trip_invitation(uuid, text, uuid, boolean),
  public.accept_trip_invitation(text)
from public, anon;

grant execute on function
  public.create_trip_invitation(uuid, text, uuid, boolean),
  public.accept_trip_invitation(text)
to authenticated;
