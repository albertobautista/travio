import { stayEvents } from "@/lib/accommodations/stays";
import { activityDate, buildItineraryDays } from "@/lib/activities/itinerary";
import { formatDuration, formatTimeRange } from "@/lib/activities/schedule";
import { legEndTitle, transportMeta } from "@/lib/transportations/types";
import { legTimes } from "@/lib/transportations/legs";
import { stopsForDate } from "@/lib/trips/stops";
import { instantToZonedTime } from "@/lib/zoned-time";

/**
 * The map page's day view, shaped like the itinerary: which cities, where the
 * night is spent, and a timeline of everything that happens (activities,
 * transfers, check-in/out, flights and trains). Rows with a place on the map
 * carry `pointId`, so the list and the pins stay in sync.
 */

export type MapRow = {
  id: string;
  kind: "activity" | "check_in" | "check_out" | "leg";
  /** "HH:MM" local time. */
  time: string;
  title: string;
  meta: string;
  /** Activity category or transport type, for the icon. */
  category: string;
  /** Id of the matching map point, when the row has coordinates. */
  pointId: string | null;
  href: string;
};

export type MapDay = {
  date: string;
  dayNumber: number | null;
  /** "mié 8 abr" */
  label: string;
  /** Cities for the day; two on a travel day ("Barcelona", "Madrid"). */
  cities: string[];
  tonight: string | null;
  rows: MapRow[];
};

type Located = { lat: number | null; lng: number | null };
const located = (r: Located) => r.lat !== null && r.lng !== null;

export function buildMapDays({
  trip,
  editable,
  stops,
  activities,
  stays,
  legs,
}: {
  trip: { id: string; start_date: string | null; end_date: string | null };
  editable: boolean;
  stops: { name: string; arrives_on: string | null; departs_on: string | null; position: number }[];
  activities: (Located & {
    id: string;
    title: string;
    category: string;
    starts_at: string;
    duration_minutes: number;
    timezone: string;
    location_name: string | null;
  })[];
  stays: (Located & { id: string; name: string; address: string | null; check_in_at: string; check_out_at: string; timezone: string })[];
  legs: {
    id: string;
    type: string;
    origin_name: string;
    destination_name: string;
    departs_at: string;
    departs_timezone: string;
    arrives_at: string;
    arrives_timezone: string;
    carrier: string | null;
    service_number: string | null;
  }[];
}): MapDay[] {
  const base = `/viajes/${trip.id}`;
  const days = buildItineraryDays(trip, activities.map(activityDate));
  const events = stayEvents(stays);

  return days.map((d) => {
    const at = (iso: string) => new Date(iso).getTime();
    // [instant, row]: sorted by real time, so rows in different zones interleave correctly.
    const rows: [number, MapRow][] = [];

    for (const a of activities) {
      if (activityDate(a) !== d.date) continue;
      rows.push([at(a.starts_at), {
        id: a.id,
        kind: "activity",
        time: instantToZonedTime(a.starts_at, a.timezone).time,
        title: a.title,
        meta: [formatTimeRange(new Date(a.starts_at), a.duration_minutes, a.timezone), formatDuration(a.duration_minutes), a.location_name]
          .filter(Boolean)
          .join(" · "),
        category: a.category,
        pointId: located(a) ? a.id : null,
        href: editable ? `${base}/actividades/${a.id}` : `${base}/itinerario?dia=${d.date}`,
      }]);
    }

    for (const e of events) {
      if (e.date !== d.date) continue;
      rows.push([e.at.getTime(), {
        id: `${e.stay.id}-${e.kind}`,
        kind: e.kind,
        time: e.time,
        title: `${e.kind === "check_in" ? "Check-in" : "Check-out"} · ${e.stay.name}`,
        meta: e.stay.address ?? "Hospedaje",
        category: e.kind,
        pointId: located(e.stay) ? e.stay.id : null,
        href: `${base}/hospedajes`,
      }]);
    }

    for (const l of legs) {
      const { departs, arrives } = legTimes(l);
      const service = [l.carrier, l.service_number].filter(Boolean).join(" ");
      const ends = [
        departs.date === d.date ? ("departs" as const) : null,
        arrives.date === d.date && arrives.date !== departs.date ? ("arrives" as const) : null,
      ];
      for (const end of ends) {
        if (!end) continue;
        rows.push([at(end === "departs" ? l.departs_at : l.arrives_at), {
          id: `${l.id}-${end}`,
          kind: "leg",
          time: end === "departs" ? departs.time : arrives.time,
          title: legEndTitle(l, end),
          meta: [`${departs.time} → ${arrives.time}`, service || transportMeta(l.type).label].join(" · "),
          category: l.type,
          pointId: null,
          href: `${base}/transporte${editable ? `/${l.id}` : ""}`,
        }]);
      }
    }

    const tonight = stays.find(
      (s) =>
        instantToZonedTime(s.check_in_at, s.timezone).date <= d.date &&
        d.date < instantToZonedTime(s.check_out_at, s.timezone).date,
    );

    return {
      date: d.date,
      dayNumber: d.dayNumber,
      label: d.label,
      cities: stopsForDate(stops, d.date).map((s) => s.name),
      tonight: tonight?.name ?? null,
      rows: rows.sort((a, b) => a[0] - b[0]).map(([, row]) => row),
    };
  });
}
