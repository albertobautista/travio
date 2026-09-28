import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * Builds the day selector for the itinerary. Each activity belongs to the
 * local date where it happens (10:30 in London on 8 Apr is 8 Apr, whatever
 * the viewer's own time zone).
 */

export type ItineraryDay = {
  date: string;
  /** "Día 3" position within the trip's dates; null for days outside them. */
  dayNumber: number | null;
  /** "mié 8 abr" */
  label: string;
  activityCount: number;
};

const weekdayDayMonth = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDayLabel(date: string) {
  return weekdayDayMonth.format(new Date(`${date}T00:00:00Z`)).replace(/[.,]/g, "").replace(/ de /g, " ");
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The local date an activity happens on. */
export function activityDate(activity: { starts_at: string; timezone: string }) {
  return instantToZonedTime(activity.starts_at, activity.timezone).date;
}

/** Longest range we list day by day, so a typo like 2026-2062 can't render 13 000 buttons. */
const MAX_TRIP_DAYS = 120;

export function buildItineraryDays(
  trip: { start_date: string | null; end_date: string | null },
  activityDates: string[],
): ItineraryDay[] {
  const counts = new Map<string, number>();
  for (const d of activityDates) counts.set(d, (counts.get(d) ?? 0) + 1);

  const tripDays: string[] = [];
  if (trip.start_date) {
    const end = trip.end_date ?? trip.start_date;
    for (let d = trip.start_date, i = 0; d <= end && i < MAX_TRIP_DAYS; d = addDays(d, 1), i++) tripDays.push(d);
  }
  const inTrip = new Map(tripDays.map((d, i) => [d, i + 1]));

  const all = [...new Set([...tripDays, ...counts.keys()])].sort();
  return all.map((date) => ({
    date,
    dayNumber: inTrip.get(date) ?? null,
    label: formatDayLabel(date),
    activityCount: counts.get(date) ?? 0,
  }));
}

/** ?dia= if valid, else today if it's a trip day, else the first day with plans, else the first day. */
export function pickDay(days: ItineraryDay[], requested: string | undefined, today: string) {
  return (
    days.find((d) => d.date === requested) ??
    days.find((d) => d.date === today) ??
    days.find((d) => d.activityCount > 0) ??
    days[0]
  );
}
