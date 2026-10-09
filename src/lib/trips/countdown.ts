import { instantToZonedTime, zonedTimeToInstant } from "@/lib/zoned-time";

import { DEFAULT_TIME_ZONE } from "./dates";

/**
 * "How long until the trip": what the countdown counts down to, and the
 * short "Faltan 35 días" for the other upcoming trips.
 */

type Leg = {
  type: string;
  carrier: string | null;
  service_number: string | null;
  origin_name: string;
  destination_name: string;
  departs_at: string;
  departs_timezone: string;
};
type Stop = { position: number; timezone: string };

export type CountdownTarget = {
  /** ISO instant the countdown reaches zero. */
  at: string;
  /** "Tu vuelo sale en" / "El viaje empieza en". */
  title: string;
  /** The departure, when it's a leg: "AA 1234 · México (MEX) 08:15 → Miami". */
  detail: string | null;
};

const LEG_TITLES: Record<string, string> = {
  flight: "Tu vuelo sale en",
  train: "Tu tren sale en",
  bus: "Tu autobús sale en",
  ferry: "Tu ferry sale en",
  car_rental: "Recoges el auto en",
};

/**
 * The first departure of the trip (a leg leaving on or before its first day,
 * in the departure's own time zone), or else midnight of the first day in the
 * first city. Null for trips without dates.
 */
export function tripCountdownTarget(startDate: string | null, stops: Stop[], legs: Leg[]): CountdownTarget | null {
  if (!startDate) return null;

  const first = legs
    .filter((l) => instantToZonedTime(l.departs_at, l.departs_timezone).date <= startDate)
    .sort((a, b) => Date.parse(a.departs_at) - Date.parse(b.departs_at))[0];
  if (first) {
    const service = [first.carrier, first.service_number].filter(Boolean).join(" ");
    const time = instantToZonedTime(first.departs_at, first.departs_timezone).time;
    return {
      at: new Date(first.departs_at).toISOString(),
      title: LEG_TITLES[first.type] ?? "Sales en",
      detail: [service, `${first.origin_name} ${time} → ${first.destination_name}`].filter(Boolean).join(" · "),
    };
  }

  const zone = [...stops].sort((a, b) => a.position - b.position)[0]?.timezone ?? DEFAULT_TIME_ZONE;
  return { at: zonedTimeToInstant(startDate, "00:00", zone).toISOString(), title: "El viaje empieza en", detail: null };
}

/** Whole days, hours and minutes left (rounded up to the minute, never negative). */
export function timeLeft(at: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(at) - now) / 60_000));
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60, done: minutes === 0 };
}

/** "Faltan 35 días", by calendar days from the trip's today to its first day. */
export function daysLeftLabel(startDate: string, today: string) {
  const days = Math.round((Date.parse(`${startDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Hoy empieza";
  if (days === 1) return "¡Es mañana!";
  if (days < 60) return `Faltan ${days} días`;
  return `Faltan ${Math.round(days / 30.44)} meses`;
}
