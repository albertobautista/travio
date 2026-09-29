import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, ChevronLeft, Plus } from "lucide-react";

import { StayCard } from "@/components/accommodations/stay-card";
import { Button } from "@/components/ui/button";
import { getAccommodations } from "@/lib/accommodations/queries";
import { getTripFiles } from "@/lib/files/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/hospedajes">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Hospedajes · ${trip.name} · Travio` : "Hospedajes · Travio" };
}

/** Stays grouped by city in route order; cities without a stay are called out while planning. */
export default async function AccommodationsPage({ params }: PageProps<"/viajes/[id]/hospedajes">) {
  const { id } = await params;
  const [trip, role, stops, stays, travelers, files] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getAccommodations(id),
    getTravelers(id),
    getTripFiles(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;
  const filesOf = (stayId: string) => files.filter((f) => f.accommodation_id === stayId);

  const groups = [
    ...stops.map((stop) => ({ key: stop.id, stop, stays: stays.filter((s) => s.trip_stop_id === stop.id) })),
    { key: "none", stop: null, stays: stays.filter((s) => !s.trip_stop_id) },
  ].filter((g) => g.stop || g.stays.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
          <Link href={base} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Hospedajes</h1>
          <p className="text-sm text-muted-foreground">Dónde duermen en cada ciudad.</p>
        </div>
        {editable && stays.length > 0 && (
          <Button asChild className="h-11 shrink-0">
            <Link href={`${base}/hospedajes/nuevo`}>
              <Plus aria-hidden="true" />
              Agregar
            </Link>
          </Button>
        )}
      </header>

      {groups.length === 0 || (stays.length === 0 && stops.length === 0) ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <BedDouble className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Aún no hay hospedajes</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {editable
              ? "Agrega dónde se quedan para tener la dirección y la reserva a la mano."
              : "Cuando alguien agregue dónde se quedan, aparecerá aquí."}
          </p>
          {editable && (
            <Button asChild>
              <Link href={`${base}/hospedajes/nuevo`}>
                <Plus aria-hidden="true" />
                Agregar hospedaje
              </Link>
            </Button>
          )}
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`city-${group.key}`} className="flex flex-col gap-3">
            <h2 id={`city-${group.key}`} className="font-semibold">
              {group.stop ? group.stop.name : "Sin ciudad"}
            </h2>
            {group.stays.length === 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-card p-4">
                <p className="text-sm text-muted-foreground">Aún no hay dónde dormir en {group.stop?.name}.</p>
                {editable && group.stop && (
                  <Button asChild variant="outline" className="h-11 shrink-0">
                    <Link href={`${base}/hospedajes/nuevo?ciudad=${group.stop.id}`}>
                      <Plus aria-hidden="true" />
                      Agregar
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              group.stays.map((stay) => (
                <StayCard
                  key={stay.id}
                  tripId={trip.id}
                  stay={stay}
                  travelers={travelers}
                  files={filesOf(stay.id)}
                  editable={editable}
                />
              ))
            )}
          </section>
        ))
      )}
    </main>
  );
}
