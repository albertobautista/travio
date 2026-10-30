-- Options (2026-10-30): stays and legs saved while comparing, before buying.
-- Design rationale: docs/data-model.md (2.7 Booking status).
--
-- An option is an accommodation or transportation row with
-- booking_status = 'option', not a separate table: it has the same data (dates,
-- price, link, notes, who goes, screenshots), so choosing one is changing a
-- single column, and nothing has to be copied. Until then it stays out of the
-- plan: the itinerary, Hoy, the map, the budget and the reminders read only
-- the other statuses (the app filters them; see getAccommodations and
-- getTransportations).
--
-- Same permissions as any stay or leg: members see options, owners and
-- editors add, change, choose and delete them.

alter table public.accommodations
  drop constraint accommodations_booking_status_check,
  add constraint accommodations_booking_status_check
    check (booking_status in ('option', 'planned', 'booked', 'confirmed'));

alter table public.transportations
  drop constraint transportations_booking_status_check,
  add constraint transportations_booking_status_check
    check (booking_status in ('option', 'planned', 'booked', 'confirmed'));

-- The options of a trip, without scanning its stays and legs.
create index accommodations_trip_options_idx on public.accommodations (trip_id) where booking_status = 'option';
create index transportations_trip_options_idx on public.transportations (trip_id) where booking_status = 'option';

-- ---------------------------------------------------------------------------
-- Change summaries: comparing options isn't news for the others. Choosing one
-- is: it reads as a stay or leg being added, and turning it back into an
-- option as one being removed. Same function as before plus that rule.
-- ---------------------------------------------------------------------------
create or replace function public.record_trip_event()
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

  if tg_table_name in ('accommodations', 'transportations') then
    if tg_op <> 'UPDATE' then
      if v_row.booking_status = 'option' then
        return null;
      end if;
    elsif old.booking_status = 'option' and new.booking_status = 'option' then
      return null;
    elsif old.booking_status = 'option' then
      v_action := 'created'; -- chosen
    elsif new.booking_status = 'option' then
      v_action := 'deleted'; -- back to being an option
    end if;
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
      if v_action = 'updated' and (old.name, old.check_in_at, old.check_out_at, old.address)
        is not distinct from (new.name, new.check_in_at, new.check_out_at, new.address) then
        return null;
      end if;
      v_detail := jsonb_build_object('title', v_row.name, 'starts_at', v_row.check_in_at, 'timezone', v_row.timezone);
    when 'transportations' then
      v_entity := 'leg';
      if v_action = 'updated' and (old.origin_name, old.destination_name, old.departs_at, old.arrives_at)
        is not distinct from (new.origin_name, new.destination_name, new.departs_at, new.arrives_at) then
        return null;
      end if;
      v_detail := jsonb_build_object(
        'title', v_row.origin_name || ' → ' || v_row.destination_name,
        'starts_at', v_row.departs_at,
        'timezone', v_row.departs_timezone
      );
      if v_action = 'updated' and old.departs_at is distinct from new.departs_at then
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
