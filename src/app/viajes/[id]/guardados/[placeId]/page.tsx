import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { SavedPlaceForm } from "@/components/saved-places/saved-place-form";
import { getSavedPlace } from "@/lib/saved-places/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

import { updateSavedPlace } from "../actions";
import { DeleteSavedPlaceButton } from "./delete-saved-place-button";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/guardados/[placeId]">): Promise<Metadata> {
  const { id, placeId } = await params;
  const place = await getSavedPlace(id, placeId);
  return { title: place ? `${place.name} · Travio` : "Lugar guardado · Travio" };
}

export default async function EditSavedPlacePage({ params }: PageProps<"/viajes/[id]/guardados/[placeId]">) {
  const { id, placeId } = await params;
  const [trip, role, stops, place] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getSavedPlace(id, placeId)]);
  if (!trip || !place) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/guardados`);
  const backHref = `/viajes/${trip.id}/guardados`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link href={backHref} className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Guardados
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{place.name}</h1>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <SavedPlaceForm
          action={updateSavedPlace.bind(null, trip.id, place.id)}
          initialValues={{
            name: place.name,
            address: place.address ?? "",
            trip_stop_id: place.trip_stop_id ?? "",
            category: place.category,
            estimated_minutes: place.estimated_minutes === null ? "" : String(place.estimated_minutes),
            external_url: place.external_url ?? "",
            notes: place.notes ?? "",
            google_place_id: place.google_place_id ?? "",
            lat: place.lat === null ? "" : String(place.lat),
            lng: place.lng === null ? "" : String(place.lng),
          }}
          stops={stops}
          submitLabel="Guardar cambios"
          cancelHref={backHref}
        />
      </div>
      <section aria-labelledby="remove-place" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-place" className="font-semibold">
          Borrar lugar
        </h2>
        <DeleteSavedPlaceButton tripId={trip.id} placeId={place.id} title={place.name} />
      </section>
    </main>
  );
}
