import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripMap } from "@/components/maps/trip-map";
import { getAccommodations } from "@/lib/accommodations/queries";
import { getActivities } from "@/lib/activities/queries";
import { buildMapCities, buildMapDays } from "@/lib/maps/days";
import { buildMapPoints } from "@/lib/maps/points";
import { getSavedPlaces } from "@/lib/saved-places/queries";
import { getTransportations } from "@/lib/transportations/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";
import { todayIn } from "@/lib/trips/dates";
import { getDailyWeather } from "@/lib/weather/open-meteo";
import { summarize } from "@/lib/weather/types";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/mapa">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Mapa · ${trip.name} · Travio` : "Mapa · Travio" };
}

export default async function TripMapPage({ params, searchParams }: PageProps<"/viajes/[id]/mapa">) {
  const { id } = await params;
  const { dia } = await searchParams;
  const [trip, role, stops, activities, stays, transportations, savedPlaces] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getAccommodations(id),
    getTransportations(id),
    getSavedPlaces(id),
  ]);
  if (!trip) notFound();

  const editable = canEdit(role);
  const pending = savedPlaces.filter((p) => p.activities.length === 0);
  const points = buildMapPoints({ tripId: trip.id, editable, activities, stays, stops, saved: pending });
  const days = buildMapDays({ trip, editable, stops, activities, stays, legs: transportations });
  const baseCities = buildMapCities({ stops, activities, stays, legs: transportations, days });

  // Weather per city over its stay (one cached request each), then per day
  // from the city the day ends in.
  const weatherByStop = new Map(
    await Promise.all(
      stops
        .filter((s) => s.lat !== null && s.lng !== null && s.arrives_on)
        .map(async (s) => [
          s.id,
          await getDailyWeather(
            { lat: s.lat!, lng: s.lng!, timezone: s.timezone },
            s.arrives_on!,
            s.departs_on ?? s.arrives_on!,
            todayIn(s.timezone),
          ),
        ] as const),
    ),
  );
  const cities = baseCities.map((c) => ({
    ...c,
    weather: summarize([...(weatherByStop.get(c.id)?.values() ?? [])]),
  }));
  const daysWithWeather = days.map((d) => {
    const stopId = [...d.stopIds].reverse().find((id) => weatherByStop.has(id));
    return { ...d, weather: stopId ? (weatherByStop.get(stopId)?.get(d.date) ?? null) : null };
  });
  // ?dia= when valid; otherwise today if it's a trip day; otherwise the whole trip.
  const today = resolveTripNow(stops).today;
  const initialDay =
    (typeof dia === "string" && days.some((d) => d.date === dia) && dia) || (days.some((d) => d.date === today) ? today : null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 lg:max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Mapa</h1>
          <p className="truncate text-sm text-muted-foreground lg:hidden">{trip.name}</p>
        </div>
      </header>
      <TripMap tripId={trip.id} editable={editable} points={points} days={daysWithWeather} cities={cities} initialDay={initialDay} />
    </main>
  );
}
