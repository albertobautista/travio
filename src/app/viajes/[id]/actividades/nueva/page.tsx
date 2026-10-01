import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ActivityForm } from "@/components/activities/activity-form";
import { isCategory, type ActivityCategory } from "@/lib/activities/categories";
import { getActivities } from "@/lib/activities/queries";
import { getSavedPlace } from "@/lib/saved-places/queries";
import { listTimeZones } from "@/lib/time-zones";
import { getTravelers } from "@/lib/travelers/queries";
import { isIsoDate } from "@/lib/trips/trip-form";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { stopForDate } from "@/lib/trips/stops";

import { createActivity } from "../actions";

export const metadata: Metadata = {
  title: "Nueva actividad · Travio",
};

export default async function NewActivityPage({ params, searchParams }: PageProps<"/viajes/[id]/actividades/nueva">) {
  const { id } = await params;
  const query = await searchParams;
  const { dia, guardado } = query;
  // From an AI idea (or any link): optional prefill, each value checked. The
  // form is still reviewed and validated on save.
  const param = (key: string, max = 200) => {
    const v = query[key];
    return typeof v === "string" ? v.trim().slice(0, max) : "";
  };
  const number = (key: string, min: number, max: number) => {
    const n = Number(param(key, 20));
    return param(key) && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const idea = {
    title: param("titulo", 120),
    place: param("lugar", 160),
    address: param("direccion", 300),
    placeId: /^[A-Za-z0-9_-]{10,300}$/.test(param("place_id", 300)) ? param("place_id", 300) : "",
    lat: number("lat", -90, 90),
    lng: number("lng", -180, 180),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(param("hora", 5)) ? param("hora", 5) : "",
    minutes: number("duracion", 5, 24 * 60),
    category: isCategory(param("categoria", 20)) ? (param("categoria", 20) as ActivityCategory) : null,
  };
  const [trip, role, stops, activities, travelers, saved] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getTravelers(id),
    // "Agregar al itinerario" from Guardados: start from that place.
    typeof guardado === "string" ? getSavedPlace(id, guardado) : null,
  ]);

  if (!trip) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}`);

  // Day from the itinerary (?dia=), else the trip's first day.
  const date = typeof dia === "string" && isIsoDate(dia) ? dia : (trip.start_date ?? "");
  const backHref = saved
    ? `/viajes/${trip.id}/guardados`
    : `/viajes/${trip.id}/itinerario${date ? `?dia=${date}` : ""}`;
  const duration = idea.minutes ?? saved?.estimated_minutes ?? 60;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Itinerario
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nueva actividad</h1>
        {idea.title ? (
          <p className="text-sm text-muted-foreground">Desde una idea con IA: revisa los datos antes de guardar.</p>
        ) : (
          saved && <p className="text-sm text-muted-foreground">Desde tus guardados: elige el día y la hora.</p>
        )}
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <ActivityForm
          action={createActivity.bind(null, trip.id)}
          initialValues={{
            title: idea.title || (saved?.name ?? ""),
            category: idea.category ?? saved?.category ?? "sightseeing",
            trip_stop_id: saved?.trip_stop_id ?? ((date && stopForDate(stops, date)?.id) || ""),
            timezone: "",
            date,
            start_time: idea.time,
            duration_hours: String(Math.floor(duration / 60)),
            duration_minutes: String(duration % 60),
            location_name: idea.place || (saved?.name ?? ""),
            address: idea.address || (saved?.address ?? ""),
            booking_status: "planned",
            reservation_ref: "",
            cost_amount: "",
            cost_currency: trip.currency,
            external_url: saved?.external_url ?? "",
            notes: saved?.notes ?? "",
            google_place_id: idea.placeId || (saved?.google_place_id ?? ""),
            lat: idea.lat !== null && idea.lng !== null ? String(idea.lat) : saved?.lat == null ? "" : String(saved.lat),
            lng: idea.lat !== null && idea.lng !== null ? String(idea.lng) : saved?.lng == null ? "" : String(saved.lng),
            // Everyone by default.
            participants: travelers.map((t) => t.id),
          }}
          stops={stops}
          travelers={travelers}
          timeZones={listTimeZones()}
          otherActivities={activities}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar actividad"
          pendingLabel="Guardando…"
          cancelHref={backHref}
          savedPlaceId={saved?.id}
        />
      </div>
    </main>
  );
}
