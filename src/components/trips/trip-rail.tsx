import Link from "next/link";
import { FileText, ImageIcon, Ticket } from "lucide-react";

import { fileHref } from "@/components/files/file-row";
import { RouteMiniMap } from "@/components/maps/route-mini-map";
import { activityDate } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { formatMoney, toCents } from "@/lib/budget/money";
import { getTripFiles } from "@/lib/files/queries";
import { legsForToday } from "@/lib/transportations/legs";
import { getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { getTripStatus } from "@/lib/trips/dates";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";
import { instantToZonedTime } from "@/lib/zoned-time";

const UPCOMING = 3;

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const formatShortDate = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`)).replace(/\./g, "");

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The trip at a glance, beside every trip page on wide screens (as in the
 * desktop mockups): the route, today's tickets, what's next and the basics.
 * The queries are the same cached ones the pages use, so they run once.
 */
export async function TripRail({ tripId }: { tripId: string }) {
  const [trip, role, stops, activities, files, travelers, legs] = await Promise.all([
    getTrip(tripId),
    getMyTripRole(tripId),
    getStops(tripId),
    getActivities(tripId),
    getTripFiles(tripId),
    getTravelers(tripId),
    getTransportations(tripId),
  ]);
  if (!trip) return null;

  const now = new Date();
  const base = `/viajes/${trip.id}`;
  const editable = canEdit(role);
  const { today, stop } = resolveTripNow(stops, now);
  const active = getTripStatus(trip.start_date, trip.end_date, today) === "active";
  const cities = stops.flatMap((s) => (s.lat !== null && s.lng !== null ? [{ id: s.id, name: s.name, lat: s.lat, lng: s.lng }] : []));
  const stopName = new Map(stops.map((s) => [s.id, s.name]));

  // Tickets for today's plans and trips (while travelling).
  const todaysActivities = new Set(activities.filter((a) => activityDate(a) === today).map((a) => a.id));
  const todaysLegs = new Set(active ? legsForToday(legs, now, today).map((l) => l.id) : []);
  const tickets = active
    ? files.filter((f) => (f.activity_id && todaysActivities.has(f.activity_id)) || (f.transportation_id && todaysLegs.has(f.transportation_id)))
    : [];

  const upcoming = activities.filter((a) => Date.parse(a.starts_at) > now.getTime()).slice(0, UPCOMING);

  return (
    <>
      {cities.length > 0 && (
        <Card
          title="Mapa del viaje"
          action={
            <Link href={`${base}/mapa`} className="text-xs font-medium text-primary hover:underline">
              Ver mapa completo
            </Link>
          }
        >
          <RouteMiniMap cities={cities} current={active ? (stop?.id ?? null) : null} className="h-48 overflow-hidden rounded-xl bg-secondary 2xl:h-56" />
          <p className="text-xs text-muted-foreground">{cities.map((c) => c.name).join(" → ")}</p>
        </Card>
      )}

      {tickets.length > 0 && (
        <Card title="Tickets de hoy">
          <ul className="flex flex-col gap-1">
            {tickets.map((f) => {
              const Icon = f.mime_type === "application/pdf" ? FileText : ImageIcon;
              const of = f.activities?.title ?? (f.transportations ? `${f.transportations.origin_name} → ${f.transportations.destination_name}` : null);
              return (
                <li key={f.id}>
                  <a
                    href={fileHref(trip.id, f.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{f.original_name}</span>
                      {of && <span className="truncate text-xs text-muted-foreground">{of}</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card
          title="Próximas actividades"
          action={
            <Link href={`${base}/itinerario`} className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          }
        >
          <ul className="flex flex-col gap-1">
            {upcoming.map((a) => {
              const { date, time } = instantToZonedTime(a.starts_at, a.timezone);
              const where = a.trip_stop_id ? stopName.get(a.trip_stop_id) : a.location_name;
              return (
                <li key={a.id}>
                  <Link
                    href={editable ? `${base}/actividades/${a.id}` : `${base}/itinerario?dia=${date}`}
                    className="-mx-2 flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="flex w-10 shrink-0 flex-col items-center rounded-lg bg-secondary py-1 text-secondary-foreground">
                      <span className="text-sm leading-none font-bold">{Number(date.slice(8))}</span>
                      <span className="text-[10px] uppercase">{formatShortDate(date).split(" ")[1]}</span>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{a.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{time}</span>
                        {where ? ` · ${where}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="Información del viaje">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Viajeros</dt>
            <dd className="truncate text-right">
              {travelers.length === 0 ? "—" : `${travelers.length} · ${travelers.map((t) => t.name.split(" ")[0]).join(", ")}`}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Ciudades</dt>
            <dd>{stops.length}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Presupuesto</dt>
            <dd>
              {trip.budget_amount === null ? (
                <Link href={`${base}/presupuesto`} className="text-primary hover:underline">
                  {editable ? "Definir" : "—"}
                </Link>
              ) : (
                <>
                  {formatMoney(toCents(Number(trip.budget_amount)), trip.currency)} {trip.currency}
                </>
              )}
            </dd>
          </div>
        </dl>
        {tickets.length === 0 && files.length > 0 && (
          <Link href={`${base}/documentos`} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <Ticket className="size-4" aria-hidden="true" />
            {files.length === 1 ? "1 documento" : `${files.length} documentos`}
          </Link>
        )}
      </Card>
    </>
  );
}
