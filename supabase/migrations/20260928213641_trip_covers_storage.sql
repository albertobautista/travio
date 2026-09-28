-- Trip cover photos in Supabase Storage.
--
-- How the pieces fit:
--   * The image bytes live in the private bucket `trip-covers`, never in Postgres.
--   * trips.cover_image_path stores only the object's path inside the bucket.
--   * Paths are "{trip_id}/{random uuid}.{ext}", so the first folder says which
--     trip an object belongs to. The Storage RLS policies below read that folder
--     and reuse the same helpers as the table policies (is_trip_member, can_edit_trip).
--   * The browser never gets a permanent URL: the server creates short-lived
--     signed URLs, and creating one requires passing the select policy.

-- ---------------------------------------------------------------------------
-- Bucket. Limits are enforced by the Storage server itself, so they hold even
-- if someone skips the checks in our UI and calls the Storage API directly.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-covers',
  'trip-covers',
  false,                                        -- private: no public URLs
  5 * 1024 * 1024,                              -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- ---------------------------------------------------------------------------
-- "{trip_id}/..." -> trip_id, or null when the first folder isn't a uuid
-- (a plain ::uuid cast would raise an error instead of just denying access).
-- ---------------------------------------------------------------------------
create function public.trip_id_from_storage_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(p_name))[1])::uuid
  end
$$;

-- ---------------------------------------------------------------------------
-- Storage RLS. storage.objects already has RLS enabled by Supabase; without a
-- matching policy every read and write is denied.
--
-- No update policy on purpose: a new cover is always a new object (new random
-- name), and the old one is deleted. Never overwriting means a cached image
-- or signed URL can't show the wrong photo.
-- ---------------------------------------------------------------------------
create policy "trip-covers: members can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.is_trip_member(public.trip_id_from_storage_path(name))
  );

create policy "trip-covers: editors can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-covers'
    and public.can_edit_trip(public.trip_id_from_storage_path(name))
  );

create policy "trip-covers: editors can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-covers'
    and public.can_edit_trip(public.trip_id_from_storage_path(name))
  );

-- ---------------------------------------------------------------------------
-- A trip can only point at a cover inside its own folder. Without this, an
-- editor could set cover_image_path to another trip's object through the API.
-- (They still couldn't see it, since signing requires the select policy, but
-- the data would be wrong.)
-- ---------------------------------------------------------------------------
alter table public.trips
  add constraint trips_cover_in_own_folder
  check (cover_image_path is null or cover_image_path like id::text || '/%');
