import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { TripForm } from "@/components/trips/trip-form";

import { createTrip } from "./actions";

export const metadata: Metadata = {
  title: "Nuevo viaje · Travio",
};

export default function NewTripPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/viajes"
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Mis viajes
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo viaje</h1>
        <p className="text-muted-foreground">
          Empieza con lo básico. Ciudades, actividades y hospedajes se agregan después.
        </p>
      </header>
      <div className="rounded-2xl border bg-card p-5">
        <TripForm action={createTrip} submitLabel="Crear viaje" pendingLabel="Creando…" cancelHref="/viajes" />
      </div>
    </main>
  );
}
