import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Plane, Plus, Scale } from "lucide-react";

import { LegOptionCard } from "@/components/options/option-cards";
import { TransportCard } from "@/components/transportations/transport-card";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/activities/itinerary";
import { getExchangeRates } from "@/lib/budget/queries";
import { getTripFiles } from "@/lib/files/queries";
import { cheapestId, fastestId, groupByRoute } from "@/lib/options/compare";
import { getTransportationOptions, getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/transporte">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Transporte · ${trip.name} · Travio` : "Transporte · Travio" };
}

/**
 * Every leg in departure order, grouped by the local departure date. Below,
 * the options being compared, grouped by route (cheapest and fastest marked).
 */
export default async function TransportationPage({ params, searchParams }: PageProps<"/viajes/[id]/transporte">) {
  const { id } = await params;
  const { opcion } = await searchParams;
  const [trip, role, legs, options, travelers, files, rates] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTransportations(id),
    getTransportationOptions(id),
    getTravelers(id),
    getTripFiles(id),
    getExchangeRates(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;

  const days = new Map<string, typeof legs>();
  for (const leg of legs) {
    const date = instantToZonedTime(leg.departs_at, leg.departs_timezone).date;
    days.set(date, [...(days.get(date) ?? []), leg]);
  }
  const routes = groupByRoute(options);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
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

      {opcion === "guardada" && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Opción guardada. Cuando se decidan, ábrela y elige “Ya la reservé”.
        </p>
      )}

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
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href={`${base}/transporte/nuevo`}>
                  <Plus aria-hidden="true" />
                  Agregar transporte
                </Link>
              </Button>
              {options.length === 0 && (
                <Button asChild variant="outline">
                  <Link href={`${base}/transporte/nuevo?opcion=1`}>
                    <Scale aria-hidden="true" />
                    Guardar una opción
                  </Link>
                </Button>
              )}
            </div>
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

      {(options.length > 0 || (editable && legs.length > 0)) && (
        <section aria-labelledby="options" className="flex flex-col gap-4 border-t pt-5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="options" className="font-semibold">
                Opciones
              </h2>
              <p className="text-sm text-muted-foreground">
                Vuelos, trenes o autobuses que están comparando. No cuentan en el itinerario ni en el presupuesto hasta que elijan uno.
              </p>
            </div>
            {editable && (
              <Button asChild variant="outline" className="h-11 shrink-0">
                <Link href={`${base}/transporte/nuevo?opcion=1`}>
                  <Scale aria-hidden="true" />
                  Guardar opción
                </Link>
              </Button>
            )}
          </div>
          {routes.map((route) => {
            const cheapest = cheapestId(route.legs, trip.currency, rates);
            const fastest = fastestId(route.legs);
            return (
              <div key={route.key} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">
                  {route.legs[0].origin_name} → {route.legs[0].destination_name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {route.legs.length === 1 ? "1 opción" : `${route.legs.length} opciones`}
                  </span>
                </h3>
                {route.legs.map((option) => (
                  <LegOptionCard
                    key={option.id}
                    tripId={trip.id}
                    option={option}
                    money={{ tripCurrency: trip.currency, rates }}
                    highlights={[...(option.id === cheapest ? ["Más barata"] : []), ...(option.id === fastest ? ["Más rápida"] : [])]}
                    fileCount={files.filter((f) => f.transportation_id === option.id).length}
                    editable={editable}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
