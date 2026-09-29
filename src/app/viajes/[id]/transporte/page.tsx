import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Plane, Plus } from "lucide-react";

import { TransportCard } from "@/components/transportations/transport-card";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/activities/itinerary";
import { getTripFiles } from "@/lib/files/queries";
import { getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/transporte">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Transporte · ${trip.name} · Travio` : "Transporte · Travio" };
}

/** Every leg in departure order, grouped by the local departure date. */
export default async function TransportationPage({ params }: PageProps<"/viajes/[id]/transporte">) {
  const { id } = await params;
  const [trip, role, legs, travelers, files] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTransportations(id),
    getTravelers(id),
    getTripFiles(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;

  const days = new Map<string, typeof legs>();
  for (const leg of legs) {
    const date = instantToZonedTime(leg.departs_at, leg.departs_timezone).date;
    days.set(date, [...(days.get(date) ?? []), leg]);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
          <Link href={base} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Transporte</h1>
          <p className="text-sm text-muted-foreground">Vuelos, trenes y traslados entre ciudades.</p>
        </div>
        {editable && legs.length > 0 && (
          <Button asChild className="h-11 shrink-0">
            <Link href={`${base}/transporte/nuevo`}>
              <Plus aria-hidden="true" />
              Agregar
            </Link>
          </Button>
        )}
      </header>

      {legs.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <Plane className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Aún no hay transporte</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {editable
              ? "Agrega vuelos, trenes o autos para ver horarios, asientos y boletos en un solo lugar."
              : "Cuando alguien agregue vuelos o trenes, aparecerán aquí."}
          </p>
          {editable && (
            <Button asChild>
              <Link href={`${base}/transporte/nuevo`}>
                <Plus aria-hidden="true" />
                Agregar transporte
              </Link>
            </Button>
          )}
        </section>
      ) : (
        [...days].map(([date, dayLegs]) => (
          <section key={date} aria-labelledby={`day-${date}`} className="flex flex-col gap-3">
            <h2 id={`day-${date}`} className="font-semibold first-letter:uppercase">
              {formatDayLabel(date)}
            </h2>
            {dayLegs.map((leg) => (
              <TransportCard
                key={leg.id}
                tripId={trip.id}
                leg={leg}
                travelers={travelers}
                files={files.filter((f) => f.transportation_id === leg.id)}
                editable={editable}
              />
            ))}
          </section>
        ))
      )}
    </main>
  );
}
