-- Emails, phase 2 (2026-10-05): change summaries and trip reminders.
--
-- 1. trip_events: every change people make to activities, stays, legs and
--    documents, written by triggers. Triggers (not the app) so nothing is
--    missed whichever screen or script made the change. Only the server's
--    notification job reads it (secret key); users have no policy on it.
-- 2. When each person last got a summary, and which reminders went out.
-- 3. The clock: pg_cron calls the app's /api/avisos/enviar every 10 minutes
--    through pg_net. The URL and the shared secret live in Supabase Vault,
--    set by hand per environment (see the README section "Avisos por correo").

-- ---------------------------------------------------------------------------
-- 1. trip_events
-- ---------------------------------------------------------------------------
create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Who did it. Changes with no signed-in user (SQL, admin) aren't recorded.
  actor_id uuid not null references public.profiles (id) on delete cascade,
  entity text not null check (entity in ('activity', 'stay', 'leg', 'file')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  -- What the email needs, captured at the time (the row may be gone later):
  -- title, and for updates the old and new start time.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index trip_events_created_at_idx on public.trip_events (created_at);
create index trip_events_trip_created_idx on public.trip_events (trip_id, created_at);

alter table public.trip_events enable row level security;
-- No policies: invisible to users; the notification job uses the secret key.

-- One function for the four tables. TG_TABLE_NAME says which one.
-- security definer: users have no insert policy on trip_events.
create function public.record_trip_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row record := coalesce(new, old);
  v_entity text;
  v_action text := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_detail jsonb;
begin
  if v_actor is null then
    return null; -- SQL scripts, admin: not someone's change
  end if;

  case tg_table_name
    when 'activities' then
      v_entity := 'activity';
      -- Only changes people notice: title, time, length, place.
      if tg_op = 'UPDATE' and (old.title, old.starts_at, old.duration_minutes, old.location_name)
        is not distinct from (new.title, new.starts_at, new.duration_minutes, new.location_name) then
        return null;
      end if;
      v_detail := jsonb_build_object('title', v_row.title, 'starts_at', v_row.starts_at, 'timezone', v_row.timezone);
      if tg_op = 'UPDATE' and old.starts_at is distinct from new.starts_at then
        v_detail := v_detail || jsonb_build_object('old_starts_at', old.starts_at);
      end if;
    when 'accommodations' then
      v_entity := 'stay';
      if tg_op = 'UPDATE' and (old.name, old.check_in_at, old.check_out_at, old.address)
        is not distinct from (new.name, new.check_in_at, new.check_out_at, new.address) then
        return null;
      end if;
      v_detail := jsonb_build_object('title', v_row.name, 'starts_at', v_row.check_in_at, 'timezone', v_row.timezone);
    when 'transportations' then
      v_entity := 'leg';
      if tg_op = 'UPDATE' and (old.origin_name, old.destination_name, old.departs_at, old.arrives_at)
        is not distinct from (new.origin_name, new.destination_name, new.departs_at, new.arrives_at) then
        return null;
      end if;
      v_detail := jsonb_build_object(
        'title', v_row.origin_name || ' → ' || v_row.destination_name,
        'starts_at', v_row.departs_at,
        'timezone', v_row.departs_timezone
      );
      if tg_op = 'UPDATE' and old.departs_at is distinct from new.departs_at then
        v_detail := v_detail || jsonb_build_object('old_starts_at', old.departs_at);
      end if;
    when 'files' then
      v_entity := 'file';
      if tg_op = 'UPDATE' then
        return null; -- renames and re-attaching aren't news
      end if;
      v_detail := jsonb_build_object('title', v_row.original_name);
  end case;

  insert into public.trip_events (trip_id, actor_id, entity, entity_id, action, detail)
  values (v_row.trip_id, v_actor, v_entity, v_row.id, v_action, v_detail);
  return null;
end;
$$;

revoke execute on function public.record_trip_event() from public, anon, authenticated;

create trigger activities_record_event
  after insert or update or delete on public.activities
  for each row execute function public.record_trip_event();
create trigger accommodations_record_event
  after insert or update or delete on public.accommodations
  for each row execute function public.record_trip_event();
create trigger transportations_record_event
  after insert or update or delete on public.transportations
  for each row execute function public.record_trip_event();
create trigger files_record_event
  after insert or delete on public.files
  for each row execute function public.record_trip_event();

-- ---------------------------------------------------------------------------
-- 2. What has been sent
-- ---------------------------------------------------------------------------
-- Changes up to this time are already in someone's summary.
alter table public.notification_preferences
  add column changes_sent_until timestamptz;

-- "Mañana empieza…" goes out once per person and trip start date (if the
-- dates move, the new start gets its own reminder).
create table public.trip_reminders_sent (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  sent_at timestamptz not null default now(),
  primary key (trip_id, user_id, start_date)
);

alter table public.trip_reminders_sent enable row level security;
-- No policies: only the notification job (secret key) reads and writes it.

-- ---------------------------------------------------------------------------
-- 3. The clock
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Asks the app to send what's due. Reads the app URL and secret from Vault;
-- without them (a fresh environment) it does nothing.
create function public.request_notification_run()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notifications_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notifications_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.request_notification_run() from public, anon, authenticated;

select cron.schedule('travio-notifications', '*/10 * * * *', 'select public.request_notification_run()');
