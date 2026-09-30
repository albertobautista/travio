import { importMapsLibrary, mapsConfigured } from "./load";
import { estimateMinutes, type Point, type TravelMode } from "./travel";

/**
 * Travel time between two points, from the Routes API (via Maps JS's
 * `Route.computeRoutes`, so it uses the same browser key; the key needs
 * "Routes API" in its API restrictions).
 *
 * Google's terms don't allow storing route results, so nothing goes to the
 * database: results are kept in memory and in sessionStorage (this tab, this
 * visit) to avoid paying twice for the same trip.
 *
 * If the API isn't available (no key, not enabled, offline, no route) the
 * answer is a straight-line estimate, flagged `estimated`.
 */

export type TravelTime = { minutes: number; meters: number | null; estimated: boolean };

const GOOGLE_MODE = { walk: "WALKING", transit: "TRANSIT", drive: "DRIVING" } as const;
const DAY = 86_400_000;
const memory = new Map<string, Promise<TravelTime>>();
// Once the API refuses (not enabled, key restrictions), stop asking this visit.
let apiRefused = false;

function cacheKey(from: Point, to: Point, mode: TravelMode, departAt: Date | null) {
  const p = (x: Point) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)}`;
  // Transit depends on the timetable: the hour matters. Walking and driving don't (much).
  const when = mode === "transit" && departAt ? departAt.toISOString().slice(0, 13) : "";
  return `travio:route:${mode}:${p(from)}>${p(to)}:${when}`;
}

function readSession(key: string): TravelTime | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TravelTime) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: TravelTime) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full: memory is enough.
  }
}

/**
 * Transit timetables only work from 7 days ago to 100 days ahead; outside
 * that, ask without a time (Google uses "now", a fair guess of the frequency).
 */
function transitDeparture(departAt: Date | null) {
  if (!departAt) return undefined;
  const now = Date.now();
  const t = departAt.getTime();
  return t > now - 7 * DAY && t < now + 100 * DAY ? departAt : undefined;
}

async function fetchTravelTime(from: Point, to: Point, mode: TravelMode, departAt: Date | null): Promise<TravelTime> {
  const estimate = { minutes: estimateMinutes(from, to, mode), meters: null, estimated: true };
  if (!mapsConfigured() || apiRefused) return estimate;
  try {
    const { Route } = await importMapsLibrary("routes");
    const { routes } = await Route.computeRoutes({
      origin: from,
      destination: to,
      travelMode: GOOGLE_MODE[mode],
      ...(mode === "transit" ? { departureTime: transitDeparture(departAt) } : {}),
      language: "es",
      // Only what we show: fewer fields = faster and a cheaper SKU.
      fields: ["durationMillis", "distanceMeters"],
    });
    const route = routes?.[0];
    if (!route?.durationMillis) return estimate;
    return { minutes: Math.max(1, Math.round(route.durationMillis / 60_000)), meters: route.distanceMeters ?? null, estimated: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/PERMISSION_DENIED|not authorized|not enabled|REQUEST_DENIED|API key/i.test(message)) {
      apiRefused = true;
      console.error("Routes API isn't enabled for this key; showing estimates. Add \"Routes API\" to the key's API restrictions.", e);
    } else {
      console.error("Routes API failed; showing an estimate", e);
    }
    return estimate;
  }
}

export function getTravelTime(from: Point, to: Point, mode: TravelMode, departAt: Date | null): Promise<TravelTime> {
  const key = cacheKey(from, to, mode, departAt);
  const cached = readSession(key);
  if (cached) return Promise.resolve(cached);
  let pending = memory.get(key);
  if (!pending) {
    pending = fetchTravelTime(from, to, mode, departAt).then((t) => {
      // Estimates aren't saved: next time the API may work.
      if (!t.estimated) writeSession(key, t);
      else memory.delete(key);
      return t;
    });
    memory.set(key, pending);
  }
  return pending;
}
