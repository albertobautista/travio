import { activityDate } from "./itinerary";

/** A row of the day's timeline, as instants in ms: an activity, a leg, a check-in… */
export type Slot = { start: number; end: number };

/**
 * When a dragged activity starts if dropped at place `to` among the day's
 * other rows (sorted by start, without it):
 *  - after a row: when that row ends (the activity before, the train's
 *    arrival, the check-in), so it follows right after it;
 *  - first: so that it ends just as the next row begins.
 * Only the dragged activity changes: the others keep their times (a museum
 * ticket or a train doesn't move because a plan was dragged past it).
 * Returns null with nothing to place it against.
 */
export function startForDrop(others: Slot[], to: number, durationMinutes: number): number | null {
  if (others.length === 0 || to < 0 || to > others.length) return null;
  if (to > 0) return others[to - 1].end;
  return others[0].start - durationMinutes * 60_000;
}

/**
 * The new start for a dropped activity, or why it can't go there: dragging
 * reorders within the day, so a place that would push it to another date
 * (before midnight, or after something that ends past it) is refused.
 */
export function dropActivity(
  activity: { starts_at: string; timezone: string; duration_minutes: number },
  others: Slot[],
  to: number,
): { startsAt: string } | { error: string } {
  const start = startForDrop(others, to, activity.duration_minutes);
  if (start === null) return { error: "No hay con qué ordenarla en este día." };
  const startsAt = new Date(start).toISOString();
  if (activityDate({ starts_at: startsAt, timezone: activity.timezone }) !== activityDate(activity)) {
    return { error: "Ahí ya no cabe en este día. Cámbiale la hora desde la actividad." };
  }
  return { startsAt };
}
