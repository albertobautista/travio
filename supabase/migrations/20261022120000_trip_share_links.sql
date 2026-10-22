-- Sharing a trip (2026-10-22): a "Compartir" button for every member, and a
-- link preview (WhatsApp, iMessage…) with the trip's cover, name, dates and
-- cities instead of Travio's generic picture. Decided with Alberto: that is
-- all someone with the link sees without being a member. Never the
-- itinerary, people, documents or bookings.
--
--   * Each trip gets a random share_code; the link is /v/<share_code>. Not
--     the trip id: ids show up in every URL a member copies, and having one
--     shouldn't be enough to see the cover.
--   * The link gives no access. Members who open it go to the trip; anyone
--     else sees the preview and needs an invitation or the group link.
--   * Chat apps fetch previews with no session, so the preview functions are
--     callable signed out. The cover's bytes are read on the server with the
--     secret key (src/lib/trips/share.ts), only after these functions found
--     the link.
--   * The group link (/unirse/<token>) shows the same preview: its people are
--     meant to join the trip, and it already showed the name and dates.

create function public.new_share_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 16 random bytes in base64url: 22 characters.
  select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_')
$$;

alter table public.trips
  add column share_code text not null unique default public.new_share_code()
  constraint trips_share_code_format check (share_code ~ '^[A-Za-z0-9_-]{22}$');

comment on column public.trips.share_code is
  'The trip''s share link (/v/<share_code>): shows a preview, gives no access. Users cannot change it.';

-- Editors may update trips (RLS), but nobody picks their own code: it would
-- make links guessable. A future "new link" would be a definer function.
create function public.check_share_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.share_code is distinct from old.share_code and auth.uid() is not null then
    raise exception 'The share code cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trips_check_share_code_change
  before update of share_code on public.trips
  for each row execute function public.check_share_code_change();

-- ---------------------------------------------------------------------------
-- trip_preview: what a link preview may show, in one place. Internal: only
-- the functions below call it (no grants).
--
-- version changes when anything on the picture changes, so the image URL
-- changes too and chat apps don't keep showing an old cover.
-- ---------------------------------------------------------------------------
create function public.trip_preview(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'trip_id', t.id,
    'trip_name', t.name,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'cities', c.cities,
    'has_cover', t.cover_image_path is not null,
    'version', left(md5(concat_ws('|', t.name, t.start_date, t.end_date, t.cover_image_path, c.cities::text)), 10)
  )
  from public.trips t
  cross join lateral (
    select coalesce(jsonb_agg(s.name order by s.position), '[]'::jsonb) as cities
    from (select name, position from public.trip_stops where trip_id = t.id order by position limit 12) s
  ) c
  where t.id = p_trip_id
$$;

-- ---------------------------------------------------------------------------
-- get_trip_share_preview: what /v/<code> shows. Callable signed out.
-- status: member (the caller is in: the page sends them to the trip) or
-- preview. Null for an unknown code.
-- ---------------------------------------------------------------------------
create function public.get_trip_share_preview(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_uid uuid := auth.uid();
begin
  select id into v_trip_id from public.trips where share_code = p_code;
  if not found then
    return null;
  end if;

  return public.trip_preview(v_trip_id) || jsonb_build_object(
    'status',
    case
      when v_uid is not null and exists (
        select 1 from public.trip_members where trip_id = v_trip_id and user_id = v_uid
      ) then 'member'
      else 'preview'
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_trip_group_link: unchanged, plus the preview's cities, has_cover and
-- version, so /unirse/<token> gets the same picture.
-- ---------------------------------------------------------------------------
create or replace function public.get_trip_group_link(p_token text)
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

  return public.trip_preview(v_link.trip_id) || jsonb_build_object(
    'status', v_status,
    'expires_at', v_link.expires_at,
    'inviter_name', (select display_name from public.profiles where id = v_link.created_by)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. trip_preview is internal; the share preview works signed out.
-- new_share_code keeps the default grants: the column default runs it as
-- whoever creates the trip.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.trip_preview(uuid),
  public.get_trip_share_preview(text)
from public, anon, authenticated;

grant execute on function public.get_trip_share_preview(text) to anon, authenticated;
