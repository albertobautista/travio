import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, ChevronLeft, ExternalLink, MapPin, Navigation, Pencil, Receipt, StickyNote, Ticket, Users } from "lucide-react";

import { FileRow, ticketHref } from "@/components/files/file-row";
import { PlacePhoto } from "@/components/maps/place-photo";
import { TravelerStack } from "@/components/travelers/traveler-avatar";
import { Button } from "@/components/ui/button";
import { BOOKING_META, CATEGORY_META, isBookingStatus, isCategory } from "@/lib/activities/categories";
import { getActivities, getActivity } from "@/lib/activities/queries";
import { findConflicts, formatDuration, formatTimeRange } from "@/lib/activities/schedule";
import { formatMoney, toCents } from "@/lib/budget/money";
import { getTripFiles } from "@/lib/files/queries";
import { directionsUrl } from "@/lib/maps/directions";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

import { rememberActivityPlace } from "../actions";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/actividades/[activityId]">): Promise<Metadata> {
  const { id, activityId } = await params;
  const activity = await getActivity(id, activityId);
  return { title: activity ? `${activity.title} · Travio` : "Actividad · Travio" };
}

const longDate = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function formatLongDate(date: string) {
  const s = longDate.format(new Date(`${date}T00:00:00Z`)).replace(/\./g, "").replace(/ de /g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One activity, to look at: what, when, where (with directions), who goes, its
 * tickets and notes. Everyone with access to the trip sees it, viewers too;
 * editors get an "Editar" button to the form at ./editar.
 */
export default async function ActivityPage({ params }: PageProps<"/viajes/[id]/actividades/[activityId]">) {
  const { id, activityId } = await params;
  const [trip, role, activity, stops, activities, travelers, tripFiles] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getActivity(id, activityId),
    getStops(id),
    getActivities(id),
    getTravelers(id),
    getTripFiles(id),
  ]);

  if (!trip || !activity) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;
  const local = instantToZonedTime(activity.starts_at, activity.timezone);
  const startsAt = new Date(activity.starts_at);

  const category = isCategory(activity.category) ? CATEGORY_META[activity.category] : CATEGORY_META.other;
  const booking = isBookingStatus(activity.booking_status) ? BOOKING_META[activity.booking_status] : null;
  const Icon = category.icon;
  const stop = stops.find((s) => s.id === activity.trip_stop_id);
  const directions = directionsUrl({ ...activity, name: activity.location_name });
  const files = tripFiles.filter((f) => f.activity_id === activity.id);

  // No participant rows means everyone goes.
  const travelerById = new Map(travelers.map((t) => [t.id, t]));
  const everyone = activity.activity_participants.length === 0;
  const people = everyone
    ? travelers
    : activity.activity_participants.flatMap((p) => travelerById.get(p.traveler_id) ?? []);

  const overlaps =
    findConflicts(
      activities.map((a) => ({
        id: a.id,
        title: a.title,
        startsAt: new Date(a.starts_at),
        durationMinutes: a.duration_minutes,
        participantIds: a.activity_participants.map((p) => p.traveler_id),
      })),
    ).get(activity.id) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`${base}/itinerario?dia=${local.date}`}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Itinerario
        </Link>
        {editable && (
          <Button asChild variant="outline" className="h-11">
            <Link href={`${base}/actividades/${activity.id}/editar`}>
              <Pencil aria-hidden="true" />
              Editar actividad
            </Link>
          </Button>
        )}
      </header>

      <article className="flex flex-col overflow-hidden rounded-[20px] border bg-card shadow-[0_1px_2px_rgba(11,27,51,.06),0_8px_24px_-12px_rgba(11,27,51,.18)]">
        <PlacePhoto
          name={activity.location_name ?? activity.title}
          query={activity.location_name ? [activity.location_name, activity.address].filter(Boolean).join(", ") : ""}
          placeId={activity.google_place_id}
          lat={activity.lat}
          lng={activity.lng}
          radius={5_000}
          remember={editable ? rememberActivityPlace.bind(null, trip.id, activity.id) : undefined}
          maxWidth={800}
          maxHeight={400}
          className="h-[200px]"
          fallback={
            <div className={`flex size-full items-center justify-center ${category.className}`} aria-hidden="true">
              <Icon className="size-12" />
            </div>
          }
        />

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl leading-tight font-bold tracking-tight">{activity.title}</h1>
            <p className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${category.className}`}>{category.label}</span>
              {booking && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${booking.className || "bg-muted text-muted-foreground"}`}>
                  {booking.label}
                </span>
              )}
            </p>
          </div>

          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex gap-3">
              <dt>
                <CalendarDays className="mt-0.5 size-4 text-primary-text" aria-hidden="true" />
                <span className="sr-only">Cuándo</span>
              </dt>
              <dd className="flex flex-col">
                <span className="font-medium">{formatLongDate(local.date)}</span>
                <span className="text-muted-foreground">
                  {formatTimeRange(startsAt, activity.duration_minutes, activity.timezone)} ({formatDuration(activity.duration_minutes)})
                  {stop ? ` · ${stop.name}` : ""}
                </span>
              </dd>
            </div>

            {(activity.location_name || activity.address) && (
              <div className="flex gap-3">
                <dt>
                  <MapPin className="mt-0.5 size-4 text-primary-text" aria-hidden="true" />
                  <span className="sr-only">Dónde</span>
                </dt>
                <dd className="flex flex-col">
                  {activity.location_name && <span className="font-medium">{activity.location_name}</span>}
                  {activity.address && activity.address !== activity.location_name && (
                    <span className="text-muted-foreground">{activity.address}</span>
                  )}
                </dd>
              </div>
            )}

            {people.length > 0 && (
              <div className="flex gap-3">
                <dt>
                  <Users className="mt-0.5 size-4 text-primary-text" aria-hidden="true" />
                  <span className="sr-only">Quién va</span>
                </dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <TravelerStack travelers={people} />
                  <span className="truncate">{everyone ? "Todo el grupo" : people.map((t) => t.name.split(" ")[0]).join(", ")}</span>
                </dd>
              </div>
            )}

            {(activity.reservation_ref || activity.cost_amount !== null) && (
              <div className="flex gap-3">
                <dt>
                  <Receipt className="mt-0.5 size-4 text-primary-text" aria-hidden="true" />
                  <span className="sr-only">Reserva</span>
                </dt>
                <dd className="flex flex-col">
                  {activity.reservation_ref && (
                    <span>
                      Referencia: <strong className="font-mono">{activity.reservation_ref}</strong>
                    </span>
                  )}
                  {activity.cost_amount !== null && (
                    <span className="text-muted-foreground">
                      {formatMoney(toCents(Number(activity.cost_amount)), activity.cost_currency ?? trip.currency)}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {overlaps.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-2.5 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {overlaps.map((o) => `Se solapa ${formatDuration(o.overlapMinutes)} con ${o.title}`).join(". ")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {directions ? (
              <Button asChild size="lg" className="h-11">
                <a href={directions} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden="true" />
                  Cómo llegar
                </a>
              </Button>
            ) : (
              <Button size="lg" className="h-11" disabled title="La actividad no tiene lugar ni dirección">
                <Navigation aria-hidden="true" />
                Cómo llegar
              </Button>
            )}
            {files.length > 0 ? (
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link href={ticketHref(trip.id, files[0].id)}>
                  <Ticket aria-hidden="true" />
                  Ver ticket
                </Link>
              </Button>
            ) : activity.external_url ? (
              <Button asChild size="lg" variant="outline" className="h-11">
                <a href={activity.external_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Ver reserva
                </a>
              </Button>
            ) : (
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link href={`${base}/mapa?dia=${local.date}`}>
                  <MapPin aria-hidden="true" />
                  Ver en el mapa
                </Link>
              </Button>
            )}
          </div>
          {files.length > 0 && activity.external_url && (
            <a
              href={activity.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Ver reserva
            </a>
          )}
        </div>
      </article>

      {activity.notes && (
        <section aria-labelledby="activity-notes" className="flex flex-col gap-2 rounded-2xl border bg-card p-5">
          <h2 id="activity-notes" className="flex items-center gap-2 font-semibold">
            <StickyNote className="size-4 text-primary-text" aria-hidden="true" />
            Notas
          </h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{activity.notes}</p>
        </section>
      )}

      <section aria-labelledby="activity-files" className="flex flex-col gap-3">
        <div>
          <h2 id="activity-files" className="font-semibold">
            Boletos y reservas {files.length > 0 && <span className="text-muted-foreground">({files.length})</span>}
          </h2>
          <p className="text-sm text-muted-foreground">Solo los ve quien tiene acceso al viaje.</p>
        </div>
        {files.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {files.map((file) => (
              <li key={file.id}>
                <FileRow tripId={trip.id} file={file} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            {editable ? (
              <>
                Aún no hay archivos.{" "}
                <Link href={`${base}/actividades/${activity.id}/editar#activity-files`} className="font-medium text-primary-text hover:underline">
                  Adjuntar boletos o reservas
                </Link>
              </>
            ) : (
              "Aún no hay archivos."
            )}
          </p>
        )}
      </section>
    </main>
  );
}
