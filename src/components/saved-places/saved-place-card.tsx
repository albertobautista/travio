import Link from "next/link";
import { CalendarCheck, CalendarPlus, Clock, ExternalLink, MapPin, Navigation, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { activityDate, formatDayLabel } from "@/lib/activities/itinerary";
import { formatDuration } from "@/lib/activities/schedule";
import { directionsUrl } from "@/lib/maps/directions";
import type { SavedPlace } from "@/lib/saved-places/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

type Props = {
  tripId: string;
  place: SavedPlace;
  editable: boolean;
  /** Day to suggest when scheduling: the city's first day, or the trip's. */
  suggestedDay: string | null;
};

/** One saved place: what, where, how long, and whether it's already planned. */
export function SavedPlaceCard({ tripId, place, editable, suggestedDay }: Props) {
  const category = isCategory(place.category) ? CATEGORY_META[place.category] : CATEGORY_META.other;
  const Icon = category.icon;
  const planned = [...place.activities].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const directions = place.address || place.lat != null ? directionsUrl(place) : null;
  const schedule = new URLSearchParams({ guardado: place.id, ...(suggestedDay ? { dia: suggestedDay } : {}) });

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${category.className}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="leading-tight font-semibold">{place.name}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{category.label}</span>
            {place.estimated_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden="true" />
                Aprox. {formatDuration(place.estimated_minutes)}
              </span>
            )}
          </p>
          {place.address && (
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{place.address}</span>
            </p>
          )}
        </div>
      </div>

      {planned.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 text-xs font-medium text-success-foreground">
          <CalendarCheck className="size-3.5 shrink-0" aria-hidden="true" />
          En el itinerario ·{" "}
          {planned
            .map((a) => `${formatDayLabel(activityDate(a))} · ${instantToZonedTime(a.starts_at, a.timezone).time}`)
            .join(", ")}
        </p>
      )}

      {place.notes && <p className="line-clamp-3 text-sm whitespace-pre-line text-foreground/80">{place.notes}</p>}

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button asChild size="sm" className="h-10">
            <Link href={`/viajes/${tripId}/actividades/nueva?${schedule}`}>
              <CalendarPlus aria-hidden="true" />
              {planned.length > 0 ? "Agregar otra vez" : "Agregar al itinerario"}
            </Link>
          </Button>
        )}
        {directions && (
          <Button asChild size="sm" variant="outline" className="h-10">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" />
              Cómo llegar
            </a>
          </Button>
        )}
        {place.external_url && (
          <Button asChild size="sm" variant="outline" className="h-10">
            <a href={place.external_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Fuente
            </a>
          </Button>
        )}
        {editable && (
          <Button asChild size="sm" variant="ghost" className="h-10">
            <Link href={`/viajes/${tripId}/guardados/${place.id}`} aria-label={`Editar ${place.name}`}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}
