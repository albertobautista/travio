import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * "% planificado" for a trip card: the average of two simple ratios.
 *  - Days: share of the trip's days with at least one activity or leg.
 *  - Nights: share of its nights (every day but the last) covered by a stay.
 * Easy to explain, and it moves as the plan fills in. null for undated trips.
 */
export function planningProgress({
  start,
  end,
  activities,
  legs,
  stays,
}: {
  start: string | null;
  end: string | null;
  activities: { starts_at: string; timezone: string }[];
  legs: { departs_at: string; departs_timezone: string }[];
  stays: { check_in_at: string; check_out_at: string; timezone: string }[];
}): number | null {
  if (!start) return null;
  const last = end ?? start;
  const days: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); days.length < 366; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > last) break;
    days.push(iso);
  }

  const planned = new Set([
    ...activities.map((a) => instantToZonedTime(a.starts_at, a.timezone).date),
    ...legs.map((l) => instantToZonedTime(l.departs_at, l.departs_timezone).date),
  ]);
  const dayShare = days.filter((d) => planned.has(d)).length / days.length;

  const nights = days.slice(0, -1);
  const covered = (night: string) =>
    stays.some(
      (s) => instantToZonedTime(s.check_in_at, s.timezone).date <= night && night < instantToZonedTime(s.check_out_at, s.timezone).date,
    );
  // A one-day trip has no nights to cover: only the days count.
  const nightShare = nights.length === 0 ? dayShare : nights.filter(covered).length / nights.length;

  return Math.round(((dayShare + nightShare) / 2) * 100);
}
