import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { SavedPlaceForm } from "@/components/saved-places/saved-place-form";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

import { createSavedPlace } from "../actions";

export const metadata: Metadata = { title: "Guardar lugar · Travio" };

export default async function NewSavedPlacePage({ params, searchParams }: PageProps<"/viajes/[id]/guardados/nuevo">) {
  const { id } = await params;
  const { ciudad } = await searchParams;
  const [trip, role, stops] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id)]);
  if (!trip) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/guardados`);

  // ?ciudad=, else the city the travelers are in right now (handy mid-trip).
  const stopId = (typeof ciudad === "string" && stops.find((s) => s.id === ciudad)?.id) || resolveTripNow(stops).stop?.id || "";
  const backHref = `/viajes/${trip.id}/guardados`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link href={backHref} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Guardados
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Guardar un lugar</h1>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <SavedPlaceForm
          action={createSavedPlace.bind(null, trip.id)}
          initialValues={{
            name: "",
            address: "",
            trip_stop_id: stopId,
            category: "sightseeing",
            estimated_minutes: "",
            external_url: "",
            notes: "",
            google_place_id: "",
            lat: "",
            lng: "",
          }}
          stops={stops}
          submitLabel="Guardar lugar"
          cancelHref={backHref}
        />
      </div>
    </main>
  );
}
