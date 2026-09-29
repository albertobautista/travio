import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TripMap } from "@/components/maps/trip-map";
import { Button } from "@/components/ui/button";
import { getAccommodations } from "@/lib/accommodations/queries";
import { getActivities } from "@/lib/activities/queries";
import { buildMapCities, buildMapDays } from "@/lib/maps/days";
import { buildMapPoints } from "@/lib/maps/points";
import { getTransportations } from "@/lib/transportations/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/mapa">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Mapa · ${trip.name} · Travio` : "Mapa · Travio" };
}

export default async function TripMapPage({ params, searchParams }: PageProps<"/viajes/[id]/mapa">) {
  const { id } = await params;
  const { dia } = await searchParams;
  const [trip, role, stops, activities, stays, transportations] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getAccommodations(id),
    getTransportations(id),
  ]);
  if (!trip) notFound();

  const editable = canEdit(role);
  const points = buildMapPoints({ tripId: trip.id, editable, activities, stays, stops });
  const days = buildMapDays({ trip, editable, stops, activities, stays, legs: transportations });
  const cities = buildMapCities({ stops, activities, stays, legs: transportations, days });
  // ?dia= when valid; otherwise today if it's a trip day; otherwise the whole trip.
  const today = resolveTripNow(stops).today;
  const initialDay =
    (typeof dia === "string" && days.some((d) => d.date === dia) && dia) || (days.some((d) => d.date === today) ? today : null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
          <Link href={`/viajes/${trip.id}`} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Mapa</h1>
          <p className="truncate text-sm text-muted-foreground">{trip.name}</p>
        </div>
      </header>
      <TripMap points={points} days={days} cities={cities} initialDay={initialDay} />
    </main>
  );
}
