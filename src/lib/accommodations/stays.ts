import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * Accommodation domain logic: nights, "where am I sleeping now", and the
 * check-in/check-out events the itinerary shows. Pure functions.
 */

type Stay = { check_in_at: string; check_out_at: string; timezone: string };

/** Nights between the local check-in and check-out dates. */
export function countNights(stay: Stay) {
  const inDate = instantToZonedTime(stay.check_in_at, stay.timezone).date;
  const outDate = instantToZonedTime(stay.check_out_at, stay.timezone).date;
  return Math.max(0, Math.round((Date.parse(`${outDate}T00:00:00Z`) - Date.parse(`${inDate}T00:00:00Z`)) / 86_400_000));
}

export type StayPhase = "before" | "staying" | "after";

export function stayPhase(stay: Stay, now: Date): StayPhase {
  if (now.getTime() < Date.parse(stay.check_in_at)) return "before";
  if (now.getTime() < Date.parse(stay.check_out_at)) return "staying";
  return "after";
}

/**
 * The stay for "Hoy": the one the travelers are in right now, else the next
 * one that checks in on `today` (local date in its own zone), else the one
 * they check out of today. Undefined when none applies.
 */
export function stayForToday<S extends Stay>(stays: S[], now: Date, today: string): S | undefined {
  const sorted = [...stays].sort((a, b) => Date.parse(a.check_in_at) - Date.parse(b.check_in_at));
  return (
    sorted.find((s) => stayPhase(s, now) === "staying") ??
    sorted.find((s) => stayPhase(s, now) === "before" && instantToZonedTime(s.check_in_at, s.timezone).date === today) ??
    sorted.find((s) => stayPhase(s, now) === "after" && instantToZonedTime(s.check_out_at, s.timezone).date === today)
  );
}

export type StayEvent<S> = {
  kind: "check_in" | "check_out";
  stay: S;
  at: Date;
  /** Local "YYYY-MM-DD" and "HH:MM" in the stay's zone. */
  date: string;
  time: string;
};

/** Check-in and check-out of every stay, as dated events for the itinerary. */
export function stayEvents<S extends Stay>(stays: S[]): StayEvent<S>[] {
  return stays.flatMap((stay) =>
    (["check_in", "check_out"] as const).map((kind) => {
      const iso = kind === "check_in" ? stay.check_in_at : stay.check_out_at;
      const local = instantToZonedTime(iso, stay.timezone);
      return { kind, stay, at: new Date(iso), date: local.date, time: local.time };
    }),
  );
}

/** Google Maps directions to an address (app on phones). No API key needed. */
export function directionsUrl(destination: string | null | undefined) {
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null;
}
