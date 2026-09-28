-- New activity category: "transfer" (traslado), e.g. hotel -> airport or a
-- shuttle between cities. Flights and trains with booking details will get
-- their own transportations table later; this covers simple transfers.
--
-- A check constraint can't be edited in place: drop it and add the new list.

alter table public.activities drop constraint activities_category_check;

alter table public.activities
  add constraint activities_category_check
  check (category in ('sightseeing', 'tour', 'food', 'transfer', 'free_time', 'nightlife', 'shopping', 'other'));
