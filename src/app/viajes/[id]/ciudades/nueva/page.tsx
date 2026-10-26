import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { StopForm } from "@/components/trips/stop-form";
import { listTimeZones } from "@/lib/time-zones";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

import { createStop } from "../actions";

export const metadata: Metadata = {
  title: "Agregar ciudad · Travio",
};

/** ?tipo=origen / ?tipo=escala preselects the kind (e.g. from the route's hints). */
const KIND_PARAM = { origen: "origin", escala: "transit" } as const;

export default async function NewStopPage({ params, searchParams }: PageProps<"/viajes/[id]/ciudades/nueva">) {
  const { id } = await params;
  const { tipo } = await searchParams;
  const [trip, role, stops] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id)]);

  if (!trip) notFound();
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
        <h1 className="text-3xl font-bold tracking-tight">Agregar ciudad</h1>
        <p className="text-muted-foreground">
          Se agrega al final de la ruta; después puedes cambiar el orden. La ciudad de origen siempre va primero.
        </p>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <StopForm
          action={createStop.bind(null, trip.id)}
          initialKind={(typeof tipo === "string" && KIND_PARAM[tipo as keyof typeof KIND_PARAM]) || "destination"}
          hasOrigin={stops.some((s) => s.kind === "origin")}
          timeZones={listTimeZones()}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Agregar ciudad"
          pendingLabel="Agregando…"
          cancelHref={`/viajes/${trip.id}`}
        />
      </div>
    </main>
  );
}
