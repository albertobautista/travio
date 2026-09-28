import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { StopForm } from "@/components/trips/stop-form";
import { listTimeZones } from "@/lib/time-zones";
import { canEdit, getMyTripRole, getStop, getTrip } from "@/lib/trips/queries";

import { updateStop } from "../actions";
import { DeleteStopButton } from "./delete-stop-button";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/ciudades/[stopId]">): Promise<Metadata> {
  const { id, stopId } = await params;
  const stop = await getStop(id, stopId);
  return { title: stop ? `${stop.name} · Travio` : "Ciudad · Travio" };
}

export default async function EditStopPage({ params }: PageProps<"/viajes/[id]/ciudades/[stopId]">) {
  const { id, stopId } = await params;
  const [trip, stop, role] = await Promise.all([getTrip(id), getStop(id, stopId), getMyTripRole(id)]);

  if (!trip || !stop) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}`);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/viajes/${trip.id}`}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {trip.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar {stop.name}</h1>
      </header>

      <div className="rounded-2xl border bg-card p-5">
        <StopForm
          action={updateStop.bind(null, trip.id, stop.id)}
          initialValues={{
            name: stop.name,
            arrives_on: stop.arrives_on ?? "",
            departs_on: stop.departs_on ?? "",
            timezone: stop.timezone,
            notes: stop.notes ?? "",
          }}
          timeZones={listTimeZones()}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          cancelHref={`/viajes/${trip.id}`}
        />
      </div>

      <section aria-labelledby="remove-stop" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-stop" className="font-semibold">
          Quitar ciudad
        </h2>
        <p className="text-sm text-muted-foreground">La ciudad desaparece de la ruta del viaje.</p>
        <DeleteStopButton tripId={trip.id} stopId={stop.id} stopName={stop.name} />
      </section>
    </main>
  );
}
