-- Favorite options (2026-11-02): while still comparing, the option you lean
-- towards for a city (stays) or a route (legs) can be marked with a star. Only
-- that one is previewed in the itinerary and the map, dashed and labeled
-- "sin reservar", so you can see where the hotel is and when the train leaves
-- before buying anything. It still stays out of Hoy, the budget, "% planned",
-- conflicts and the reminders. Design rationale: docs/data-model.md (2.7).
--
-- One favorite per city / route is kept by the app (the server action clears
-- the others in the same group, the same grouping the Opciones lists use);
-- legs group by route ignoring case and accents, which is app logic.
--
-- Same permissions as the rest of the row: owners and editors.

alter table public.accommodations add column favorite boolean not null default false;
alter table public.transportations add column favorite boolean not null default false;

-- Only an option can be the favorite: once chosen (or edited into another
-- status) the star goes away by itself, so it never lingers on a booked stay.
create or replace function public.clear_favorite_unless_option()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_status <> 'option' then
    new.favorite := false;
  end if;
  return new;
end $$;

create trigger accommodations_clear_favorite
  before insert or update of booking_status, favorite on public.accommodations
  for each row execute function public.clear_favorite_unless_option();

create trigger transportations_clear_favorite
  before insert or update of booking_status, favorite on public.transportations
  for each row execute function public.clear_favorite_unless_option();

alter table public.accommodations
  add constraint accommodations_favorite_only_option check (not favorite or booking_status = 'option');
alter table public.transportations
  add constraint transportations_favorite_only_option check (not favorite or booking_status = 'option');
