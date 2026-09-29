import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * Transportation domain logic: local times at each end, "+1" day markers and
 * what Hoy should show. Pure functions.
 */

type Leg = {
  departs_at: string;
  departs_timezone: string;
  arrives_at: string;
  arrives_timezone: string;
};

/** Local date/time at both ends, and how many calendar days later it arrives (local dates). */
export function legTimes(leg: Leg) {
  const departs = instantToZonedTime(leg.departs_at, leg.departs_timezone);
  const arrives = instantToZonedTime(leg.arrives_at, leg.arrives_timezone);
  const dayShift = Math.round((Date.parse(`${arrives.date}T00:00:00Z`) - Date.parse(`${departs.date}T00:00:00Z`)) / 86_400_000);
  return { departs, arrives, dayShift };
}

/** "08:10 → 11:30" or "22:40 → 07:05 (+1)", each end in its own local time. */
export function formatLegTimes(leg: Leg) {
  const { departs, arrives, dayShift } = legTimes(leg);
  const shift = dayShift === 0 ? "" : ` (${dayShift > 0 ? "+" : ""}${dayShift})`;
  return `${departs.time} → ${arrives.time}${shift}`;
}

/** "2 h 20 min" of real travel time (instants, so time zones don't distort it). */
export function legMinutes(leg: Leg) {
  return Math.round((Date.parse(leg.arrives_at) - Date.parse(leg.departs_at)) / 60_000);
}

/**
 * Legs for "Hoy": those under way now, plus those departing on `today`
 * (local date at departure) that haven't arrived yet.
 */
export function legsForToday<L extends Leg>(legs: L[], now: Date, today: string): L[] {
  const t = now.getTime();
  return legs
    .filter((l) => {
      if (Date.parse(l.arrives_at) <= t) return false; // already arrived
      if (Date.parse(l.departs_at) <= t) return true; // under way
      return instantToZonedTime(l.departs_at, l.departs_timezone).date === today;
    })
    .sort((a, b) => Date.parse(a.departs_at) - Date.parse(b.departs_at));
}
