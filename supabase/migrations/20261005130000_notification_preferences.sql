-- What emails each person wants (2026-10-05). No row means the defaults:
-- members on, changes in a daily summary, trip reminders on.
--
-- unsubscribe_token: the one-click "No recibir más avisos" link in every
-- notification works without signing in (mail apps call it on their own), so
-- the link carries this random token instead of the user id.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Someone joined or left a trip I own or invited them to.
  members boolean not null default true,
  -- Changes other members make: grouped every hour, once a day, or never.
  changes text not null default 'daily' check (changes in ('hourly', 'daily', 'off')),
  -- The day before a trip starts.
  reminders boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

create policy "notification_preferences: own row"
  on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_preferences: create own row"
  on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_preferences: update own row"
  on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
