-- Trip documents: tickets, reservations, boarding passes, insurance...
-- Design rationale: docs/data-model.md (Files).
--
-- Two halves that must agree:
--   * The bytes live in the private Storage bucket `trip-files`.
--   * public.files holds the metadata: which trip, who uploaded it, the path
--     inside the bucket, the original name, type, size and what it's for.
--
-- Paths are "{trip_id}/{file_id}/{safe-name}":
--   * The first folder is the trip, so Storage RLS can check membership from
--     the path alone (same helper as the covers: trip_id_from_storage_path).
--   * The second folder is the files row id, so each object belongs to exactly
--     one row, and a check constraint below ties the two together.
--   * The last part is a sanitized copy of the original name (Storage keys
--     don't like accents or spaces); the real name is kept in original_name.
--
-- Upload flow (see src/lib/files/upload.ts):
--   1. The browser uploads straight to Storage. The bucket's insert policy
--      checks that the user can edit the trip; the bucket itself checks size
--      and type.
--   2. A server action reads the stored object's real size and type from
--      Storage and inserts the files row. If that fails it deletes the object.

-- ---------------------------------------------------------------------------
-- Bucket. Limits decided with Alberto on 2026-09-29: 10 MB, PDF + images.
-- Enforced by the Storage server, so they hold even if someone calls the
-- Storage API directly instead of using our UI. Keep src/lib/files/rules.ts
-- in sync.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-files',
  'trip-files',
  false,                                        -- private: no public URLs, ever
  10 * 1024 * 1024,                             -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- ---------------------------------------------------------------------------
-- Metadata table.
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  storage_path text not null unique,
  original_name text not null check (char_length(btrim(original_name)) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  document_type text not null default 'other'
    check (document_type in ('flight', 'train', 'hotel', 'tour', 'ticket', 'insurance', 'other')),
  -- What the file is attached to. None = a trip-level document.
  -- accommodation_id / transportation_id arrive with those tables.
  activity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The object must sit in this trip's folder, in this row's own subfolder.
  -- Without this, an editor could register another trip's path through the API.
  constraint files_path_matches_row
    check (storage_path like trip_id::text || '/' || id::text || '/%'),
  -- The activity must be in the same trip. Deleting it keeps the file as a
  -- trip document (decision 4 in docs/data-model.md).
  constraint files_activity_same_trip
    foreign key (trip_id, activity_id) references public.activities (trip_id, id)
    on delete set null (activity_id)
);

-- The Documents page lists a trip's files; activities look up their attachments.
create index files_trip_idx on public.files (trip_id, created_at);
create index files_activity_idx on public.files (trip_id, activity_id) where activity_id is not null;

create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Table RLS: members read (viewers too: they need their tickets), editors write.
-- ---------------------------------------------------------------------------
alter table public.files enable row level security;

create policy "files: members can read"
  on public.files for select to authenticated
  using (public.is_trip_member(trip_id));

-- uploaded_by must be the caller: nobody can register a file in someone else's name.
create policy "files: editors can add"
  on public.files for insert to authenticated
  with check (public.can_edit_trip(trip_id) and uploaded_by = auth.uid());

create policy "files: editors can update"
  on public.files for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "files: editors can delete"
  on public.files for delete to authenticated
  using (public.can_edit_trip(trip_id));

-- Metadata edits (type, attachment) must not move the row to another trip or
-- point it at a different object; only the Storage upload decides those.
create function public.files_freeze_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id <> old.trip_id
    or new.storage_path <> old.storage_path
    or new.mime_type <> old.mime_type
    or new.size_bytes <> old.size_bytes
    or new.uploaded_by is distinct from old.uploaded_by then
    raise exception 'A file''s trip, path, type, size and uploader cannot change';
  end if;
  return new;
end;
$$;

create trigger files_freeze_location
  before update on public.files
  for each row execute function public.files_freeze_location();

-- ---------------------------------------------------------------------------
-- Storage RLS for the bucket. Same shape as trip-covers: the first folder of
-- the path is the trip. No update policy: files are never overwritten; a new
-- version is a new upload.
-- ---------------------------------------------------------------------------
create policy "trip-files: members can view"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-files'
    and public.is_trip_member(public.trip_id_from_storage_path(name))
  );

create policy "trip-files: editors can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-files'
    and public.can_edit_trip(public.trip_id_from_storage_path(name))
  );

create policy "trip-files: editors can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-files'
    and public.can_edit_trip(public.trip_id_from_storage_path(name))
  );
