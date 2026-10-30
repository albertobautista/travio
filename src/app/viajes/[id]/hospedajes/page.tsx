import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CheckCircle2, Plus, Scale } from "lucide-react";

import { StayCard } from "@/components/accommodations/stay-card";
import { StayOptionCard } from "@/components/options/option-cards";
import { Button } from "@/components/ui/button";
import { getAccommodationOptions, getAccommodations } from "@/lib/accommodations/queries";
import { getExchangeRates } from "@/lib/budget/queries";
import { getTripFiles } from "@/lib/files/queries";
import { cheapestId, priceInTripCurrency } from "@/lib/options/compare";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { isDestination, routeOrder } from "@/lib/trips/stops";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/hospedajes">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Hospedajes · ${trip.name} · Travio` : "Hospedajes · Travio" };
}

/**
 * Stays grouped by city in route order; cities without a stay are called out
 * while planning. Each city also lists its options: places saved while
 * comparing, cheapest first, until one is chosen.
 */
export default async function AccommodationsPage({ params, searchParams }: PageProps<"/viajes/[id]/hospedajes">) {
  const { id } = await params;
  const { opcion } = await searchParams;
  const [trip, role, stops, stays, options, travelers, files, rates] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getAccommodations(id),
    getAccommodationOptions(id),
    getTravelers(id),
    getTripFiles(id),
    getExchangeRates(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;
  const filesOf = (stayId: string) => files.filter((f) => f.accommodation_id === stayId);
  const money = { tripCurrency: trip.currency, rates };
  // Cheapest first; without a price (or a rate to compare it) last.
  const price = (o: (typeof options)[number]) => priceInTripCurrency(o, trip.currency, rates) ?? Number.POSITIVE_INFINITY;
  const byPrice = (list: typeof options) => [...list].sort((a, b) => price(a) - price(b));

  const groups = [
    ...routeOrder(stops).map((stop) => ({
      key: stop.id,
      stop,
      stays: stays.filter((s) => s.trip_stop_id === stop.id),
      options: byPrice(options.filter((o) => o.trip_stop_id === stop.id)),
    })),
    { key: "none", stop: null, stays: stays.filter((s) => !s.trip_stop_id), options: byPrice(options.filter((o) => !o.trip_stop_id)) },
    // Home and connections don't need a bed: listed only if one was added anyway.
  ].filter((g) => (g.stop && isDestination(g.stop)) || g.stays.length > 0 || g.options.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
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

      {opcion === "guardada" && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Opción guardada. Cuando se decidan, ábrela y elige “Ya la reservé”.
        </p>
      )}

      {groups.length === 0 || (stays.length === 0 && options.length === 0 && !stops.some(isDestination)) ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <BedDouble className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Aún no hay hospedajes</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {editable
              ? "Agrega dónde se quedan para tener la dirección y la reserva a la mano."
              : "Cuando alguien agregue dónde se quedan, aparecerá aquí."}
          </p>
          {editable && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href={`${base}/hospedajes/nuevo`}>
                  <Plus aria-hidden="true" />
                  Agregar hospedaje
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${base}/hospedajes/nuevo?opcion=1`}>
                  <Scale aria-hidden="true" />
                  Guardar una opción
                </Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`city-${group.key}`} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id={`city-${group.key}`} className="font-semibold">
                {group.stop ? group.stop.name : "Sin ciudad"}
              </h2>
              {editable && (
                <Button asChild variant="ghost" className="h-11 shrink-0 text-primary-text">
                  <Link href={`${base}/hospedajes/nuevo?opcion=1${group.stop ? `&ciudad=${group.stop.id}` : ""}`}>
                    <Scale aria-hidden="true" />
                    Guardar opción
                  </Link>
                </Button>
              )}
            </div>
            {group.stays.length === 0 && !group.stop ? null : group.stays.length === 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {group.options.length > 0
                    ? `Aún no eligen dónde dormir en ${group.stop?.name}.`
                    : `Aún no hay dónde dormir en ${group.stop?.name}.`}
                </p>
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
            {group.options.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {group.options.length === 1 ? "1 opción" : `${group.options.length} opciones`} · sin reservar
                </h3>
                {group.options.map((option) => (
                  <StayOptionCard
                    key={option.id}
                    tripId={trip.id}
                    option={option}
                    money={money}
                    highlights={cheapestId(group.options, trip.currency, rates) === option.id ? ["Más barata"] : []}
                    fileCount={filesOf(option.id).length}
                    editable={editable}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </main>
  );
}
