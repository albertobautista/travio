-- Seat map for flights (2026-11-24): the form draws a generic cabin so each
-- traveler can tap their seat instead of typing "14A", and the cards show
-- where everyone sits. Design rationale: docs/data-model.md (2.3).
--
-- Generic cabins only, no airline or aircraft data: the layout is just how
-- many seats there are per row between the aisles. The seats themselves stay
-- in transportation_participants.seat (they belong to the person), so the
-- map is only a different way of reading and writing that column.
--
-- Null = not chosen; the app then guesses from the seat letters already saved
-- (an older flight with "14A" and "14F" shows as 3-3).
--
-- Same permissions as the rest of the row: owners and editors.

alter table public.transportations
  add column seat_layout text
    check (seat_layout in ('2-2', '3-3', '2-4-2', '3-3-3', '3-4-3'));
