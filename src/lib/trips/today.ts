import { DEFAULT_TIME_ZONE, todayIn } from "./dates";
import { isDestination } from "./stops";

/**
 * What "today" means for a trip: the calendar date where the travelers are,
 * not where the server (or the viewer) is. A trip's stops know their time
 * zones, so we look for the stop whose stay includes its own local today.
 */

type StopLike = {
  timezone: string;
  arrives_on: string | null;
  departs_on: string | null;
  /** Stop kind (stops.ts); missing means a destination. */
  kind?: string;
};

export type TripNow<S extends StopLike> = {
  /** "YYYY-MM-DD" in `timeZone`. */
  today: string;
  timeZone: string;
  /** The stop the travelers are at today, if the stays say so. */
  stop: S | undefined;
};

export function resolveTripNow<S extends StopLike>(stops: S[], now: Date = new Date()): TripNow<S> {
  const current = stops.filter((s) => {
    if (!s.arrives_on) return false;
    const localToday = todayIn(s.timezone, now);
    return s.arrives_on <= localToday && localToday <= (s.departs_on ?? s.arrives_on);
  });

  // A connection (transit) only counts when no destination does: on the day
  // you land in London after changing planes in Mexico City, you're in London.
  const candidates = current.some(isDestination) ? current.filter(isDestination) : current;

  // On a travel day two stays match: the one being left (departs today) and
  // the one being reached. Prefer a stop the travelers aren't leaving today.
  const stop = candidates.find((s) => s.departs_on !== todayIn(s.timezone, now)) ?? candidates[0];
  if (stop) return { today: todayIn(stop.timezone, now), timeZone: stop.timezone, stop };

  // Not at any stop (before/after the trip, or stops without dates): use the
  // origin's zone, or else the first stop's, which is usually where the trip starts.
  const timeZone = (stops.find((s) => s.kind === "origin") ?? stops[0])?.timezone ?? DEFAULT_TIME_ZONE;
  return { today: todayIn(timeZone, now), timeZone, stop: undefined };
}
