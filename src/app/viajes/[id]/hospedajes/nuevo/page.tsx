import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AccommodationForm } from "@/components/accommodations/accommodation-form";
import { DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME } from "@/lib/accommodations/accommodation-form";
import { listTimeZones } from "@/lib/time-zones";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

import { createAccommodation } from "../actions";

export const metadata: Metadata = {
  title: "Nuevo hospedaje · Travio",
};

export default async function NewAccommodationPage({ params, searchParams }: PageProps<"/viajes/[id]/hospedajes/nuevo">) {
  const { id } = await params;
  const { ciudad } = await searchParams;
  const [trip, role, stops, travelers] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getTravelers(id)]);

  if (!trip) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/hospedajes`);

  // ?ciudad= from "Aún no hay dónde dormir en…": start from that city's dates.
  const stop = typeof ciudad === "string" ? stops.find((s) => s.id === ciudad) : undefined;
  const backHref = `/viajes/${trip.id}/hospedajes`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Hospedajes
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo hospedaje</h1>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <AccommodationForm
          action={createAccommodation.bind(null, trip.id)}
          initialValues={{
            name: "",
            trip_stop_id: stop?.id ?? "",
            timezone: "",
            check_in_date: stop?.arrives_on ?? "",
            check_in_time: DEFAULT_CHECK_IN_TIME,
            check_out_date: stop?.departs_on ?? "",
            check_out_time: DEFAULT_CHECK_OUT_TIME,
            address: "",
            booking_status: "booked",
            booking_ref: "",
            booking_url: "",
            cost_amount: "",
            cost_currency: trip.currency,
            notes: "",
            google_place_id: "",
            lat: "",
            lng: "",
            // Everyone by default.
            participants: travelers.map((t) => t.id),
          }}
          stops={stops}
          travelers={travelers}
          timeZones={listTimeZones()}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar hospedaje"
          cancelHref={backHref}
        />
      </div>
    </main>
  );
}
