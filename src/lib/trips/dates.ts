/**
 * Trip date logic. Trip dates are calendar dates ("YYYY-MM-DD" from Postgres
 * `date` columns), not instants, so all math here is done on UTC midnight to
 * avoid the user's time zone shifting a day.
 */

export type TripStatus = "active" | "upcoming" | "past" | "undated";

/**
 * Time zone used to decide what "today" is on the server until we know each
 * user's (or each trip stop's) time zone.
 */
export const DEFAULT_TIME_ZONE = "America/Mexico_City";

/** Today's calendar date in a time zone, as "YYYY-MM-DD". */
export function todayIn(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()) {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/**
 * Derived, never stored (see docs/data-model.md, 2.6).
 * A trip with only a start date is treated as a one-day trip.
 */
export function getTripStatus(
  startDate: string | null,
  endDate: string | null,
  today: string,
): TripStatus {
  if (!startDate) return "undated";
  const end = endDate ?? startDate;
  // "YYYY-MM-DD" strings compare correctly as plain strings.
  if (today < startDate) return "upcoming";
  if (today > end) return "past";
  return "active";
}

function toUtcDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inclusive number of days: 6–20 Apr is 15 days. Null without both dates. */
export function getTripLengthDays(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return null;
  return Math.round((toUtcDate(endDate).getTime() - toUtcDate(startDate).getTime()) / DAY_MS) + 1;
}

/** 1-based day of the trip for `today`, e.g. "día 3 de 14". Null if not active. */
export function getTripDayNumber(startDate: string | null, endDate: string | null, today: string) {
  if (getTripStatus(startDate, endDate, today) !== "active" || !startDate) return null;
  return getTripLengthDays(startDate, today);
}

const dayMonth = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// es-MX abbreviates months with a trailing dot ("abr."); the mockups don't.
const clean = (s: string) => s.replace(/\./g, "").replace(/ de /g, " ");

/**
 * Compact range like the mockups:
 * "6 – 20 abr 2026", "25 nov – 6 dic 2026", "17 feb 2026 – 3 mar 2027".
 */
export function formatTripDates(startDate: string | null, endDate: string | null) {
  if (!startDate) return "Sin fechas";
  const start = toUtcDate(startDate);
  if (!endDate || endDate === startDate) return clean(dayMonthYear.format(start));

  const end = toUtcDate(endDate);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) return `${start.getUTCDate()} – ${clean(dayMonthYear.format(end))}`;
  if (sameYear) return `${clean(dayMonth.format(start))} – ${clean(dayMonthYear.format(end))}`;
  return `${clean(dayMonthYear.format(start))} – ${clean(dayMonthYear.format(end))}`;
}
