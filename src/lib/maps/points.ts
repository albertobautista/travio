import { activityDate } from "@/lib/activities/itinerary";
import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * What the trip map shows, built on the server from rows that have
 * coordinates. Pure data (serializable) so it can go to the client component.
 */

export type MapPoint = {
  id: string;
  kind: "activity" | "stay" | "stop";
  title: string;
  lat: number;
  lng: number;
  /** Activity category (for the pin color); null for stays and stops. */
  category: string | null;
  /** "HH:MM" local time for activities; null otherwise. */
  time: string | null;
  /** Local dates the point belongs to (an activity: its day; a stay: each night slept there). */
  dates: string[];
  /** Stays only: the check-out date and time, so a travel day can show "Check-out · 09:00". */
  checkOut: { date: string; time: string } | null;
  subtitle: string | null;
  href: string | null;
  /** Place id when known, for precise "Cómo llegar" links. */
  placeId: string | null;
};

type Located = { lat: number | null; lng: number | null; google_place_id: string | null };

const hasCoords = <T extends Located>(row: T): row is T & { lat: number; lng: number } =>
  row.lat !== null && row.lng !== null;

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 120) break;
  }
  return out;
}

/** Dates from check-in to the night before check-out (a same-day stay counts once). */
function nights(checkIn: string, checkOut: string) {
  const all = datesBetween(checkIn, checkOut);
  return all.length > 1 ? all.slice(0, -1) : all;
}

export function buildMapPoints({
  tripId,
  editable,
  activities,
  stays,
  stops,
}: {
  tripId: string;
  editable: boolean;
  activities: (Located & { id: string; title: string; category: string; starts_at: string; timezone: string; location_name: string | null; address: string | null })[];
  stays: (Located & { id: string; name: string; address: string | null; check_in_at: string; check_out_at: string; timezone: string })[];
  stops: (Located & { id: string; name: string; arrives_on: string | null; departs_on: string | null })[];
}): MapPoint[] {
  const base = `/viajes/${tripId}`;
  return [
    ...stops.filter(hasCoords).map(
      (s): MapPoint => ({
        id: s.id,
        kind: "stop",
        title: s.name,
        lat: s.lat,
        lng: s.lng,
        category: null,
        time: null,
        dates: s.arrives_on ? datesBetween(s.arrives_on, s.departs_on ?? s.arrives_on) : [],
        checkOut: null,
        subtitle: null,
        href: editable ? `${base}/ciudades/${s.id}` : null,
        placeId: s.google_place_id,
      }),
    ),
    ...stays.filter(hasCoords).map(
      (s): MapPoint => ({
        id: s.id,
        kind: "stay",
        title: s.name,
        lat: s.lat,
        lng: s.lng,
        category: null,
        time: null,
        // The nights: check-in date up to the day before check-out. On the
        // check-out day the traveler sleeps elsewhere (or flies home).
        dates: nights(
          instantToZonedTime(s.check_in_at, s.timezone).date,
          instantToZonedTime(s.check_out_at, s.timezone).date,
        ),
        checkOut: instantToZonedTime(s.check_out_at, s.timezone),
        subtitle: s.address,
        href: `${base}/hospedajes${editable ? `/${s.id}` : ""}`,
        placeId: s.google_place_id,
      }),
    ),
    ...activities.filter(hasCoords).map(
      (a): MapPoint => ({
        id: a.id,
        kind: "activity",
        title: a.title,
        lat: a.lat,
        lng: a.lng,
        category: a.category,
        time: instantToZonedTime(a.starts_at, a.timezone).time,
        dates: [activityDate(a)],
        checkOut: null,
        subtitle: a.location_name ?? a.address,
        href: editable ? `${base}/actividades/${a.id}` : `${base}/itinerario?dia=${activityDate(a)}`,
        placeId: a.google_place_id,
      }),
    ),
  ];
}
