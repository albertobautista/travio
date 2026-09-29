import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TransportForm } from "@/components/transportations/transport-form";
import { listTimeZones } from "@/lib/time-zones";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

import { createTransportation } from "../actions";

export const metadata: Metadata = {
  title: "Nuevo transporte · Travio",
};

export default async function NewTransportationPage({ params }: PageProps<"/viajes/[id]/transporte/nuevo">) {
  const { id } = await params;
  const [trip, role, stops, travelers] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getTravelers(id)]);

  if (!trip) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/transporte`);
  const backHref = `/viajes/${trip.id}/transporte`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Transporte
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo transporte</h1>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <TransportForm
          action={createTransportation.bind(null, trip.id)}
          initialValues={{
            type: "flight",
            origin_name: "",
            departs_timezone: "",
            departs_date: "",
            departs_time: "",
            departure_detail: "",
            destination_name: "",
            arrives_timezone: "",
            arrives_date: "",
            arrives_time: "",
            arrival_detail: "",
            carrier: "",
            service_number: "",
            booking_status: "booked",
            booking_ref: "",
            booking_url: "",
            cost_amount: "",
            cost_currency: trip.currency,
            notes: "",
            // Everyone by default, no seats.
            participants: travelers.map((t) => t.id),
            seats: {},
          }}
          stops={stops}
          travelers={travelers}
          timeZones={listTimeZones()}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar transporte"
          cancelHref={backHref}
        />
      </div>
    </main>
  );
}
