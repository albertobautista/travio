import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react";

import { moveStop } from "@/app/viajes/[id]/ciudades/actions";
import { Button } from "@/components/ui/button";
import { formatTripDates, getNights } from "@/lib/trips/dates";

type Stop = {
  id: string;
  name: string;
  timezone: string;
  arrives_on: string | null;
  departs_on: string | null;
};

function stayLabel(stop: Stop) {
  if (!stop.arrives_on) return "Sin fechas";
  const nights = getNights(stop.arrives_on, stop.departs_on);
  const dates = formatTripDates(stop.arrives_on, stop.departs_on, { year: false });
  if (nights === null || nights === 0) return dates;
  return `${dates} · ${nights === 1 ? "1 noche" : `${nights} noches`}`;
}

/** "Europe/London" -> "London", "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
function zoneCity(timezone: string) {
  return timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
}

export function TripRoute({ tripId, stops, editable }: { tripId: string; stops: Stop[]; editable: boolean }) {
  return (
    <section aria-labelledby="route-heading" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="route-heading" className="font-semibold">
          Ruta
        </h2>
        {editable && stops.length > 0 && (
          <Button asChild variant="ghost" className="h-11 text-primary">
            <Link href={`/viajes/${tripId}/ciudades/nueva`}>
              <Plus aria-hidden="true" />
              Agregar ciudad
            </Link>
          </Button>
        )}
      </div>

      {stops.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hay ciudades en este viaje.</p>
          {editable && (
            <Button asChild>
              <Link href={`/viajes/${tripId}/ciudades/nueva`}>
                <Plus aria-hidden="true" />
                Agregar la primera ciudad
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ol className="relative flex flex-col">
          {/* The line connecting the stops. */}
          <span aria-hidden="true" className="absolute top-6 bottom-6 left-[13px] w-0.5 bg-timeline" />
          {stops.map((stop, index) => {
            const content = (
              <>
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{stop.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {stayLabel(stop)} · hora de {zoneCity(stop.timezone)}
                  </span>
                </span>
              </>
            );

            return (
              <li key={stop.id} className="flex items-center gap-1 py-1.5">
                {editable ? (
                  <Link
                    href={`/viajes/${tripId}/ciudades/${stop.id}`}
                    className="-my-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pr-1 hover:bg-muted"
                  >
                    {content}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-3">{content}</span>
                )}
                {editable && stops.length > 1 && (
                  <span className="flex shrink-0">
                    <form action={moveStop.bind(null, stop.id, -1)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        disabled={index === 0}
                        aria-label={`Mover ${stop.name} antes`}
                      >
                        <ChevronUp aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={moveStop.bind(null, stop.id, 1)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        disabled={index === stops.length - 1}
                        aria-label={`Mover ${stop.name} después`}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </form>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
