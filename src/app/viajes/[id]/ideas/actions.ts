"use server";

import { getAccommodations } from "@/lib/accommodations/queries";
import { activityDate, formatDayLabel } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { aiConfigured, askGapIdeas, cleanIdeas, type GapContext } from "@/lib/ai/gap-ideas";
import { distanceMeters, type Point } from "@/lib/maps/travel";
import { getSavedPlaces } from "@/lib/saved-places/queries";
import { createClient } from "@/lib/supabase/server";
import { getTravelers } from "@/lib/travelers/queries";
import { getStops, getTrip } from "@/lib/trips/queries";
import { stopsForDate } from "@/lib/trips/stops";
import { isUuid } from "@/lib/uuid";
import { getDailyWeather } from "@/lib/weather/open-meteo";
import { weatherMeta } from "@/lib/weather/types";
import { instantToZonedTime } from "@/lib/zoned-time";

export type GapIdea = {
  title: string;
  placeName: string;
  searchQuery: string;
  category: string;
  durationMinutes: number;
  reason: string;
  /** Saved places come with their data; the rest is checked in Places by the browser. */
  saved: { id: string; lat: number | null; lng: number | null; address: string | null; placeId: string | null } | null;
};

export type GapIdeasResult =
  | {
      ideas: GapIdea[];
      remaining: number;
      city: string;
      /** Where you start (the previous plan, else the hotel, else the city) and where you go next. */
      from: (Point & { label: string }) | null;
      next: (Point & { label: string }) | null;
      gapStart: string; // ISO
      gapEnd: string;
      date: string;
      timeZone: string;
    }
  | { error: string };

const MIN_GAP = 30;

/**
 * Ideas for the free time between two activities. Everything about the gap
 * is read here from the database (through RLS), never taken from the browser:
 * the browser only says which two activities.
 */
export async function suggestGapIdeas(tripId: string, fromActivityId: string, toActivityId: string): Promise<GapIdeasResult> {
  if (!isUuid(tripId) || !isUuid(fromActivityId) || !isUuid(toActivityId)) return { error: "No encontramos ese hueco." };
  if (!aiConfigured()) return { error: "Las ideas con IA no están configuradas en este servidor." };

  const [trip, activities, stops, stays, saved, travelers] = await Promise.all([
    getTrip(tripId),
    getActivities(tripId),
    getStops(tripId),
    getAccommodations(tripId),
    getSavedPlaces(tripId),
    getTravelers(tripId),
  ]);
  if (!trip) return { error: "Este viaje no existe." };
  if (!trip.ai_enabled) return { error: "Las ideas con IA están apagadas en este viaje." };
  const prev = activities.find((a) => a.id === fromActivityId);
  const next = activities.find((a) => a.id === toActivityId);
  if (!prev || !next) return { error: "No encontramos ese hueco." };

  const gapStartMs = Date.parse(prev.starts_at) + prev.duration_minutes * 60_000;
  const gapEndMs = Date.parse(next.starts_at);
  const gapMinutes = Math.round((gapEndMs - gapStartMs) / 60_000);
  if (gapMinutes < MIN_GAP) return { error: "Ese hueco es muy corto para una idea." };
  if (gapEndMs < Date.now()) return { error: "Ese hueco ya pasó." };

  const date = activityDate(next);
  const timeZone = next.timezone;
  const stop = stops.find((s) => s.id === next.trip_stop_id) ?? stopsForDate(stops, date).at(-1);
  const hotel = stays.find(
    (s) => instantToZonedTime(s.check_in_at, s.timezone).date <= date && date < instantToZonedTime(s.check_out_at, s.timezone).date,
  );
  const pointOf = (x: { lat: number | null; lng: number | null }) => (x.lat !== null && x.lng !== null ? { lat: x.lat, lng: x.lng } : null);
  const fromPoint = pointOf(prev) ?? (hotel ? pointOf(hotel) : null) ?? (stop ? pointOf(stop) : null);
  const fromLabel = pointOf(prev) ? (prev.location_name ?? prev.title) : hotel && pointOf(hotel) ? hotel.name : (stop?.name ?? "");
  const nextPoint = pointOf(next);

  const citySaved = saved.filter((p) => p.activities.length === 0 && (!stop || p.trip_stop_id === stop.id || p.trip_stop_id === null));
  const weather =
    stop && stop.lat !== null && stop.lng !== null
      ? (await getDailyWeather({ lat: stop.lat, lng: stop.lng, timezone: stop.timezone }, date, date, date)).get(date)
      : undefined;

  const context: GapContext = {
    city: stop?.name ?? "",
    date,
    dayLabel: formatDayLabel(date),
    gapStart: instantToZonedTime(new Date(gapStartMs), timeZone).time,
    gapEnd: instantToZonedTime(new Date(gapEndMs), timeZone).time,
    gapMinutes,
    from: fromPoint ? { label: fromLabel, ...fromPoint } : null,
    next: nextPoint ? { label: next.location_name ?? next.title, ...nextPoint } : null,
    hotel: hotel?.name ?? null,
    weather: weather
      ? `${weatherMeta(weather.code).label}, ${weather.max}°/${weather.min}°${weather.rainChance !== null ? `, lluvia ${weather.rainChance}%` : ""}${weather.kind === "typical" ? " (típico de la fecha)" : ""}`
      : null,
    travelers: Math.max(1, travelers.length),
    saved: citySaved.slice(0, 40).map((p) => {
      const pt = pointOf(p);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        notes: p.notes ? p.notes.slice(0, 200) : null,
        km: pt && fromPoint ? Math.round(distanceMeters(fromPoint, pt) / 100) / 10 : null,
        minutes: p.estimated_minutes,
      };
    }),
    planned: [
      ...new Set(
        activities
          .filter((a) => !stop || a.trip_stop_id === stop.id)
          .map((a) => a.location_name ?? a.title)
          .filter(Boolean),
      ),
    ].slice(0, 80),
  };

  // Count it (and check the switch and membership again) only once we know
  // it's a real request.
  const supabase = await createClient();
  const { data: remaining, error: claimError } = await supabase.rpc("claim_ai_request", { p_trip_id: trip.id });
  if (claimError) {
    if (claimError.hint === "limit") return { error: "Llegaste al límite de 30 ideas por día. Vuelve mañana." };
    if (claimError.code === "42501") return { error: "Las ideas con IA están apagadas en este viaje." };
    console.error("claim_ai_request failed", claimError);
    return { error: "No pudimos pedir ideas ahora. Inténtalo de nuevo." };
  }

  let raw;
  try {
    raw = await askGapIdeas(context);
  } catch (e) {
    console.error("askGapIdeas failed", e);
    return { error: "La IA no respondió. Inténtalo de nuevo en un momento." };
  }

  const savedById = new Map(citySaved.map((p) => [p.id, p]));
  const ideas: GapIdea[] = cleanIdeas(raw, new Set(savedById.keys()), gapMinutes).map((i) => {
    const s = i.savedPlaceId ? savedById.get(i.savedPlaceId) : undefined;
    return {
      title: i.title,
      placeName: s?.name ?? i.placeName,
      searchQuery: i.searchQuery || `${i.placeName}, ${context.city}`,
      category: i.category,
      durationMinutes: i.durationMinutes,
      reason: i.reason,
      saved: s ? { id: s.id, lat: s.lat, lng: s.lng, address: s.address, placeId: s.google_place_id } : null,
    };
  });

  return {
    ideas,
    remaining: remaining ?? 0,
    city: context.city,
    from: fromPoint ? { label: fromLabel, ...fromPoint } : null,
    next: nextPoint ? { label: context.next!.label, ...nextPoint } : null,
    gapStart: new Date(gapStartMs).toISOString(),
    gapEnd: new Date(gapEndMs).toISOString(),
    date,
    timeZone,
  };
}
