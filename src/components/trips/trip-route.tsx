import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react";

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

/**
 * The trip's cities in order. Reordering is a mode ("Ordenar", ?ordenar=1),
 * so the up/down buttons don't crowd the list the rest of the time.
 * During the trip, `currentStopId` marks the city you're in and `today` dims the ones done.
 */
export function TripRoute({
  tripId,
  stops,
  editable,
  sorting = false,
  today = null,
  currentStopId = null,
}: {
  tripId: string;
  stops: Stop[];
  editable: boolean;
  sorting?: boolean;
  today?: string | null;
  /** Where the travelers are today (resolveTripNow: on a travel day, the city reached). */
  currentStopId?: string | null;
}) {
  const canSort = editable && stops.length > 1;
  const reorder = sorting && canSort;
  return (
    <section aria-labelledby="route-heading" className="flex flex-col gap-3 rounded-[18px] border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="route-heading" className="font-semibold">
          Ruta{stops.length > 0 ? ` · ${stops.length === 1 ? "1 ciudad" : `${stops.length} ciudades`}` : ""}
        </h2>
        <div className="flex">
          {canSort && (
            <Button asChild variant="ghost" className="h-11 text-primary">
              {/* scroll={false}: stay at the route, don't jump to the top. */}
              <Link href={reorder ? `/viajes/${tripId}` : `/viajes/${tripId}?ordenar=1`} scroll={false}>
                {reorder ? <Check aria-hidden="true" /> : <ArrowUpDown aria-hidden="true" />}
                {reorder ? "Listo" : "Ordenar"}
              </Link>
            </Button>
          )}
          {editable && stops.length > 0 && !reorder && (
            <Button asChild variant="ghost" size="icon" className="size-11 text-primary">
              <Link href={`/viajes/${tripId}/ciudades/nueva`} aria-label="Agregar ciudad">
                <Plus aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
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
            const done = today !== null && stop.departs_on !== null && stop.departs_on < today;
            const here = stop.id === currentStopId;
            const content = (
              <>
                <span
                  className={
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                    (done ? "bg-success text-white" : here ? "bg-primary text-primary-foreground ring-4 ring-secondary" : today ? "border-2 border-primary/30 bg-card text-primary" : "bg-primary text-primary-foreground")
                  }
                >
                  {index + 1}
                </span>
                <span className={"flex min-w-0 flex-1 flex-col " + (done ? "opacity-60" : "")}>
                  <span className="truncate font-semibold">
                    {stop.name}
                    {here && <span className="text-xs font-semibold text-primary"> · estás aquí</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stayLabel(stop)}
                    {reorder ? "" : ` · hora de ${zoneCity(stop.timezone)}`}
                  </span>
                </span>
              </>
            );

            return (
              <li key={stop.id} className="flex items-center gap-1 py-1.5">
                {editable && !reorder ? (
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
                {reorder && (
                  <span className="flex shrink-0 animate-rise">
                    <form action={moveStop.bind(null, stop.id, -1)}>
                      <Button type="submit" variant="ghost" size="icon" className="size-11" disabled={index === 0} aria-label={`Mover ${stop.name} antes`}>
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
