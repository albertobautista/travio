import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ActivityForm } from "@/components/activities/activity-form";
import { getActivities } from "@/lib/activities/queries";
import { listTimeZones } from "@/lib/time-zones";
import { isIsoDate } from "@/lib/trips/trip-form";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { stopForDate } from "@/lib/trips/stops";

import { createActivity } from "../actions";

export const metadata: Metadata = {
  title: "Nueva actividad · Travio",
};

export default async function NewActivityPage({ params, searchParams }: PageProps<"/viajes/[id]/actividades/nueva">) {
  const { id } = await params;
  const { dia } = await searchParams;
  const [trip, role, stops, activities] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getActivities(id)]);

  if (!trip) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}`);

  // Day from the itinerary (?dia=), else the trip's first day.
  const date = typeof dia === "string" && isIsoDate(dia) ? dia : (trip.start_date ?? "");
  const backHref = `/viajes/${trip.id}/itinerario${date ? `?dia=${date}` : ""}`;

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
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <ActivityForm
          action={createActivity.bind(null, trip.id)}
          initialValues={{
            title: "",
            category: "sightseeing",
            trip_stop_id: (date && stopForDate(stops, date)?.id) || "",
            timezone: "",
            date,
            start_time: "",
            duration_hours: "1",
            duration_minutes: "0",
            location_name: "",
            address: "",
            booking_status: "planned",
            reservation_ref: "",
            cost_amount: "",
            cost_currency: trip.currency,
            external_url: "",
            notes: "",
          }}
          stops={stops}
          timeZones={listTimeZones()}
          otherActivities={activities}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar actividad"
          pendingLabel="Guardando…"
          cancelHref={backHref}
        />
      </div>
    </main>
  );
}
