import { stopForDate } from "@/lib/trips/stops";
import { zonedTimeToInstant } from "@/lib/zoned-time";

import type { ActivityData } from "./activity-form";
import { addDays } from "./itinerary";

/**
 * "Repetir otros días": the same activity (breakfast at the hotel, the gym…)
 * on several days of the trip. Each day gets its own ordinary activity row, so
 * one day can later be moved, edited or deleted without touching the rest, and
 * everything that reads activities (itinerary, Hoy, conflicts, budget, map)
 * keeps working unchanged. There is no recurrence rule to keep in sync.
 */

type Trip = { start_date: string | null; end_date: string | null };
type Stop = { id: string; timezone: string; arrives_on: string | null; departs_on: string | null };

/** Longest trip we offer day by day (same idea as the itinerary's limit). */
const MAX_DAYS = 120;

/** Every date of the trip, in order. Empty when it has no dates yet. */
export function tripDates({ start_date, end_date }: Trip): string[] {
  if (!start_date || !end_date || end_date < start_date) return [];
  const dates: string[] = [];
  for (let d = start_date; d <= end_date && dates.length < MAX_DAYS; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/**
 * The extra days the user checked, validated: inside the trip, not the
 * activity's own day, no repeats, in order. Anything else is dropped.
 */
export function parseRepeatDates(raw: string[], trip: Trip, mainDate: string): string[] {
  const allowed = new Set(tripDates(trip));
  return [...new Set(raw)].filter((d) => allowed.has(d) && d !== mainDate).sort();
}

/**
 * One copy of `data` per date, at the same local time. If the activity has a
 * city and a day belongs to a different one (a multi-city trip), that copy
 * moves to that day's city and time zone, and leaves the place empty: the
 * hotel in London isn't the hotel in Krakow.
 */
export function buildRepeats(
  data: ActivityData,
  startTime: string,
  dates: string[],
  stops: Stop[],
): ActivityData[] {
  return dates.map((date) => {
    const own = stops.find((s) => s.id === data.trip_stop_id);
    const that = data.trip_stop_id ? stopForDate(stops, date) : undefined;
    const coversDay = own?.arrives_on && own.arrives_on <= date && date <= (own.departs_on ?? own.arrives_on);
    const moved = that && that.id !== data.trip_stop_id && !coversDay;
    const timezone = moved ? that.timezone : data.timezone;
    return {
      ...data,
      ...(moved && {
        trip_stop_id: that.id,
        location_name: null,
        address: null,
        google_place_id: null,
        lat: null,
        lng: null,
      }),
      timezone,
      starts_at: zonedTimeToInstant(date, startTime, timezone).toISOString(),
    };
  });
}
