-- Contextual AI: ideas for free time between activities (decided with Alberto
-- on 2026-10-01). Off by default per trip; only the owner turns it on or off.
-- Every member may ask for ideas, up to a daily limit per person.

-- ---------------------------------------------------------------------------
-- The switch.
-- ---------------------------------------------------------------------------
alter table public.trips add column ai_enabled boolean not null default false;

comment on column public.trips.ai_enabled is
  'Whether members can ask for AI ideas (trip data is sent to the AI provider). Only the owner can change it.';

-- Editors may update trips (RLS), but not this column: only the owner decides
-- whether the trip's data goes to an AI provider. RLS can't restrict a single
-- column, so a trigger checks it. On insert the creator becomes the owner, so
-- anyone creating a trip may set it.
create function public.check_ai_enabled_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ai_enabled is distinct from old.ai_enabled
     and coalesce(public.trip_role(new.id), '') <> 'owner'
     -- Server-side maintenance (no signed-in user) isn't limited.
     and auth.uid() is not null then
    raise exception 'Only the owner can turn AI suggestions on or off'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trips_check_ai_enabled_change
  before update of ai_enabled on public.trips
  for each row execute function public.check_ai_enabled_change();

-- ---------------------------------------------------------------------------
-- ai_requests: one row per request, to limit how many a person makes a day
-- (each one costs money). No content is stored, only who and when.
-- ---------------------------------------------------------------------------
create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_requests_user_created_idx on public.ai_requests (user_id, created_at);

alter table public.ai_requests enable row level security;

-- People see their own requests (for "N left today"). Rows are only added
-- through claim_ai_request, so there's no insert policy.
create policy "ai_requests: users read their own"
  on public.ai_requests for select to authenticated
  using (user_id = (select auth.uid()));

-- Checks the trip allows AI and the caller is a member, applies the daily
-- limit, and records the request. Returns how many are left today.
-- security definer: it inserts into ai_requests, which users can't write.
create function public.claim_ai_request(p_trip_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Fixed here, not a parameter: callers could pass any number.
  v_limit constant integer := 30;
  v_used integer;
begin
  if (select auth.uid()) is null or public.trip_role(p_trip_id) is null then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.trips where id = p_trip_id and ai_enabled) then
    raise exception 'AI suggestions are off for this trip' using errcode = '42501';
  end if;

  -- One request at a time per person, so two quick taps can't both pass the check.
  perform pg_advisory_xact_lock(hashtext('ai_requests:' || (select auth.uid())::text));
  select count(*) into v_used
    from public.ai_requests
    where user_id = (select auth.uid()) and created_at > now() - interval '24 hours';
  if v_used >= v_limit then
    raise exception 'Daily AI limit reached' using errcode = 'P0001', hint = 'limit';
  end if;

  insert into public.ai_requests (user_id, trip_id) values ((select auth.uid()), p_trip_id);
  return v_limit - v_used - 1;
end;
$$;

revoke execute on function public.claim_ai_request(uuid) from public, anon;
grant execute on function public.claim_ai_request(uuid) to authenticated;
