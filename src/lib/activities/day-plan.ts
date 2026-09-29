import { findConflicts, getEnd, type Conflict } from "./schedule";

/**
 * Today's plan for the "Hoy" screen: which activity is done, happening now or
 * next, the free time between them, and overlaps. Pure, so it's easy to test
 * with any "now".
 */

export type PlanActivity = {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  participantIds: string[];
};

export type PlanState = "done" | "now" | "upcoming";

export type PlanItem<A extends PlanActivity> =
  | { kind: "activity"; activity: A; state: PlanState; isNext: boolean; conflicts: Conflict[] }
  /** A gap of at least MIN_FREE_MINUTES between the end of one activity and the start of the next. */
  | { kind: "free"; from: Date; minutes: number };

const MIN_FREE_MINUTES = 30;
const MINUTE = 60_000;

export function buildDayPlan<A extends PlanActivity>(activities: A[], now: Date) {
  const sorted = [...activities].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const conflicts = findConflicts(sorted);
  const t = now.getTime();

  const stateOf = (a: A): PlanState => {
    if (getEnd(a.startsAt, a.durationMinutes).getTime() <= t) return "done";
    if (a.startsAt.getTime() <= t) return "now";
    return "upcoming";
  };

  // Several activities can be "now" or "next" at once (different travelers, or
  // an overlap), so these are lists. "Next" is every activity starting at the
  // earliest upcoming start time.
  const current = sorted.filter((a) => stateOf(a) === "now");
  const firstNext = sorted.find((a) => stateOf(a) === "upcoming");
  const next = firstNext
    ? sorted.filter((a) => stateOf(a) === "upcoming" && a.startsAt.getTime() === firstNext.startsAt.getTime())
    : [];

  const items: PlanItem<A>[] = [];
  let latestEnd: number | null = null;
  for (const a of sorted) {
    const start = a.startsAt.getTime();
    if (latestEnd !== null && start - latestEnd >= MIN_FREE_MINUTES * MINUTE) {
      items.push({ kind: "free", from: new Date(latestEnd), minutes: Math.round((start - latestEnd) / MINUTE) });
    }
    items.push({
      kind: "activity",
      activity: a,
      state: stateOf(a),
      isNext: next.includes(a),
      conflicts: conflicts.get(a.id) ?? [],
    });
    const end = getEnd(a.startsAt, a.durationMinutes).getTime();
    latestEnd = latestEnd === null ? end : Math.max(latestEnd, end);
  }

  /** The hero cards: what's happening now, else what's next. */
  const focus = current.length > 0 ? current : next;
  return { items, current, next, focus };
}

/** Activities a traveler takes part in: those for everyone plus those listing them. */
export function forTraveler<A extends { participantIds: string[] }>(activities: A[], travelerId: string | null) {
  if (!travelerId) return activities;
  return activities.filter((a) => a.participantIds.length === 0 || a.participantIds.includes(travelerId));
}

/** "en 1 h 05 min", "en 25 min", "en menos de 1 min". */
export function formatStartsIn(startsAt: Date, now: Date) {
  const minutes = Math.ceil((startsAt.getTime() - now.getTime()) / MINUTE);
  if (minutes <= 0) return "ahora";
  if (minutes < 1) return "en menos de 1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `en ${m} min`;
  return m === 0 ? `en ${h} h` : `en ${h} h ${String(m).padStart(2, "0")} min`;
}
