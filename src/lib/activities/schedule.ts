/**
 * Itinerary domain logic: end times, overlaps and formatting. Pure functions,
 * used by the server (itinerary) and the browser (live preview in the form).
 */

import { instantToZonedTime } from "@/lib/zoned-time";

export type Schedulable = {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  /** Traveler ids taking part. Empty or missing means everyone. */
  participantIds?: string[];
};

export type Conflict = {
  /** The other activity. */
  id: string;
  title: string;
  overlapMinutes: number;
};

const MINUTE = 60_000;

/** The end is never stored: start + duration. */
export function getEnd(startsAt: Date, durationMinutes: number) {
  return new Date(startsAt.getTime() + durationMinutes * MINUTE);
}

/** Whether two activities have at least one traveler in common ("everyone" shares with anyone). */
function sharePeople(a: Schedulable, b: Schedulable) {
  if (!a.participantIds?.length || !b.participantIds?.length) return true;
  const other = new Set(b.participantIds);
  return a.participantIds.some((id) => other.has(id));
}

/**
 * Every pair of activities whose time ranges overlap and that share at least
 * one traveler, reported on both sides. Ana at a museum while Leo is on a tour
 * is fine; nobody can be in two places at once.
 * Back-to-back activities (one ends 12:00, the next starts 12:00) don't count.
 *
 * Sorted by start, each activity only needs to be compared with the ones that
 * start before it ends, so we can stop scanning early.
 */
export function findConflicts(activities: Schedulable[]): Map<string, Conflict[]> {
  const sorted = [...activities].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const conflicts = new Map<string, Conflict[]>();
  const add = (on: Schedulable, other: Schedulable, minutes: number) => {
    const list = conflicts.get(on.id) ?? [];
    list.push({ id: other.id, title: other.title, overlapMinutes: minutes });
    conflicts.set(on.id, list);
  };

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = getEnd(a.startsAt, a.durationMinutes).getTime();
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bStart = b.startsAt.getTime();
      if (bStart >= aEnd) break; // later ones start even later
      if (!sharePeople(a, b)) continue;
      const bEnd = getEnd(b.startsAt, b.durationMinutes).getTime();
      const minutes = Math.round((Math.min(aEnd, bEnd) - bStart) / MINUTE);
      add(a, b, minutes);
      add(b, a, minutes);
    }
  }
  return conflicts;
}

/** 90 -> "1 h 30", 45 -> "45 min", 120 -> "2 h", 1560 -> "1 d 2 h". */
export function formatDuration(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return [`${days} d`, hours ? `${hours} h` : null, mins ? `${mins} min` : null].filter(Boolean).join(" ");
  if (hours === 0) return `${mins} min`;
  return mins ? `${hours} h ${String(mins).padStart(2, "0")}` : `${hours} h`;
}

/**
 * "10:30 – 12:00" in the activity's own time zone. If it ends on a later local
 * day, "(+1)" like the mockups: "21:30 – 15:20 (+1)".
 */
export function formatTimeRange(startsAt: Date, durationMinutes: number, timeZone: string) {
  const start = instantToZonedTime(startsAt, timeZone);
  const end = instantToZonedTime(getEnd(startsAt, durationMinutes), timeZone);
  const dayDiff = Math.round(
    (Date.parse(`${end.date}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / (1440 * MINUTE),
  );
  return `${start.time} – ${end.time}${dayDiff > 0 ? ` (+${dayDiff})` : ""}`;
}
