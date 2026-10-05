-- accept_trip_invitation also returns the role and who sent the invitation
-- (2026-10-05), so the app can email them "Ximena se unió a …". Same body as
-- in 20261003120000_invitation_kinds.sql otherwise.

create or replace function public.accept_trip_invitation(p_token text)
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

  return jsonb_build_object('status', 'joined', 'trip_id', v_inv.trip_id, 'role', v_inv.role, 'invited_by', v_inv.created_by);
end;
$$;
