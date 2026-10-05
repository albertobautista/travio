-- Invitations by email (2026-10-05): the owner can type the invitee's email
-- and Travio sends the link. The link and the single-use token work exactly as
-- before; the email is only where it was sent (shown in "Invitaciones
-- pendientes"), not a restriction on who may accept it.
--
-- Abuse limit: 20 invitation emails per owner per day, checked in the
-- database so the app can't skip it.

alter table public.trip_invitations
  add column email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

drop function public.create_trip_invitation(uuid, text, uuid, boolean);

create function public.create_trip_invitation(
  p_trip_id uuid,
  p_role text,
  p_traveler_id uuid default null,
  p_adds_traveler boolean default false,
  p_email text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_token text;
  v_email text := nullif(lower(btrim(p_email)), '');
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

  if v_email is not null and (
    select count(*) from public.trip_invitations
    where created_by = (select auth.uid())
      and email is not null
      and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'Too many invitation emails today' using errcode = '53400';
  end if;

  -- 32 random bytes as base64url (43 characters, safe in a URL path).
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_');

  -- RLS (owner only) and the one-kind check apply here.
  insert into public.trip_invitations (trip_id, token_hash, role, traveler_id, adds_traveler, email)
  values (p_trip_id, public.invitation_token_hash(v_token), p_role, p_traveler_id, coalesce(p_adds_traveler, false), v_email)
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

revoke execute on function public.create_trip_invitation(uuid, text, uuid, boolean, text) from public, anon;
grant execute on function public.create_trip_invitation(uuid, text, uuid, boolean, text) to authenticated;
