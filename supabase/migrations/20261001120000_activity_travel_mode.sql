-- How to get to an activity from the one before it, for the travel-time
-- check between activities (decided with Alberto on 2026-10-01).
-- null = automatic: walk when it's close, else public transport.
alter table public.activities
  add column travel_mode text check (travel_mode in ('walk', 'transit', 'drive'));

comment on column public.activities.travel_mode is
  'How to get here from the previous activity: walk, transit or drive. Null = automatic (walk if close, else transit).';
