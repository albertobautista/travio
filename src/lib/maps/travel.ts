import { Bus, Car, Footprints, type LucideIcon } from "lucide-react";

/**
 * Travel time between activities: which pairs to check, how to get there,
 * and whether the gap is enough. Pure and client-safe; the actual times come
 * from the Routes API in the browser (lib/maps/routes.ts).
 */

export const TRAVEL_MODES = ["walk", "transit", "drive"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_MODE_META: Record<TravelMode, { label: string; short: string; icon: LucideIcon }> = {
  walk: { label: "A pie", short: "a pie", icon: Footprints },
  transit: { label: "Transporte público", short: "en transporte", icon: Bus },
  drive: { label: "En coche", short: "en coche", icon: Car },
};

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === "string" && (TRAVEL_MODES as readonly string[]).includes(value);
}

/** Up to this distance (straight line) the automatic mode is walking. */
export const WALK_UP_TO_METERS = 1500;
/** Arriving with less spare time than this gets a soft warning (queues, finding the entrance…). */
export const MARGIN_MINUTES = 10;
/** Closer than this, it's the same place: nothing to check. */
const SAME_PLACE_METERS = 60;

export type Point = { lat: number; lng: number };

/** Straight-line distance in meters (haversine). */
export function distanceMeters(a: Point, b: Point) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The mode used when the activity doesn't set one. */
export function autoMode(from: Point, to: Point): TravelMode {
  return distanceMeters(from, to) <= WALK_UP_TO_METERS ? "walk" : "transit";
}

/**
 * A rough time when the Routes API isn't available: straight-line distance
 * with a detour factor, at typical city speeds, plus waiting/parking time.
 */
export function estimateMinutes(from: Point, to: Point, mode: TravelMode) {
  const km = (distanceMeters(from, to) * 1.3) / 1000;
  const kmh = { walk: 4.5, transit: 18, drive: 25 }[mode];
  const extra = { walk: 0, transit: 6, drive: 5 }[mode];
  return Math.max(1, Math.round((km / kmh) * 60 + extra));
}

export type Verdict = "ok" | "tight" | "late";

/** Enough time? late: the trip doesn't fit; tight: it fits with less than MARGIN_MINUTES spare. */
export function travelVerdict(gapMinutes: number, travelMinutes: number): Verdict {
  const spare = gapMinutes - travelMinutes;
  if (spare < 0) return "late";
  if (spare < MARGIN_MINUTES) return "tight";
  return "ok";
}

export type PairStop = {
  id: string;
  /** "transfer" activities are the trip itself, so pairs around them aren't checked. */
  category: string;
  start: Date;
  end: Date;
  point: Point | null;
  /** Empty = everyone. */
  participantIds: string[];
};

/**
 * Which consecutive activities to check, from a day's rows in time order.
 * `null` entries are anything else in between (a flight, a check-in): they
 * break the chain, since you don't go straight from one activity to the next.
 * Skipped: transfers, activities without coordinates, overlapping ones (the
 * conflict warning covers them), different people, and the same place.
 */
export function travelPairs<S extends PairStop>(rows: (S | null)[]) {
  const pairs: { from: S; to: S; gapMinutes: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const from = rows[i - 1];
    const to = rows[i];
    if (!from || !to || !from.point || !to.point) continue;
    if (from.category === "transfer" || to.category === "transfer") continue;
    const gapMinutes = Math.round((to.start.getTime() - from.end.getTime()) / 60_000);
    if (gapMinutes < 0) continue;
    const shared =
      from.participantIds.length === 0 || to.participantIds.length === 0 || from.participantIds.some((id) => to.participantIds.includes(id));
    if (!shared) continue;
    if (distanceMeters(from.point, to.point) < SAME_PLACE_METERS) continue;
    pairs.push({ from, to, gapMinutes });
  }
  return pairs;
}
