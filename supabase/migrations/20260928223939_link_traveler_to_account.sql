-- Link a traveler to an existing Travio account by email, giving that account
-- access to the trip in the same step.
--
-- Why a security definer function: emails live in auth.users, which the app
-- can't read (and shouldn't). This function runs with the table owner's
-- rights, so it checks by itself that the caller is the trip's owner before
-- looking anything up. Only owners manage access (same rule as the
-- trip_members policies).
--
-- Trade-off: an owner can learn whether an email has a Travio account. That's
-- inherent to sharing by email; limiting it to owners keeps it small.

create function public.link_traveler_to_account(p_traveler_id uuid, p_email text, p_role text default 'viewer')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_user_id uuid;
  v_added boolean := false;
  v_role text;
begin
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer' using errcode = '22023';
  end if;

  select trip_id into v_trip_id from public.travelers where id = p_traveler_id;
  -- Same answer whether the traveler doesn't exist or the caller isn't the
  -- owner, so non-owners learn nothing.
  if v_trip_id is null or public.trip_role(v_trip_id) is distinct from 'owner' then
    raise exception 'Only the trip owner can link accounts' using errcode = '42501';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
    and deleted_at is null
    and not coalesce(is_anonymous, false);
  if v_user_id is null then
    raise exception 'No Travio account with that email' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.travelers
    where trip_id = v_trip_id and user_id = v_user_id and id <> p_traveler_id
  ) then
    raise exception 'That account is already linked to another traveler' using errcode = '23505';
  end if;

  -- Give access if they don't have it yet. Someone who already has access
  -- keeps their role: linking must not silently promote or demote anyone.
  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip_id, v_user_id, p_role)
  on conflict (trip_id, user_id) do nothing;
  v_added := found;

  select role into v_role from public.trip_members where trip_id = v_trip_id and user_id = v_user_id;

  update public.travelers set user_id = v_user_id where id = p_traveler_id;

  return jsonb_build_object(
    'display_name', (select display_name from public.profiles where id = v_user_id),
    'access_added', v_added,
    'role', v_role
  );
end;
$$;

revoke execute on function public.link_traveler_to_account(uuid, text, text) from public, anon;
grant execute on function public.link_traveler_to_account(uuid, text, text) to authenticated;
