import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import { FileRow } from "@/components/files/file-row";
import { TravelerAvatar, TravelerStack } from "@/components/travelers/traveler-avatar";
import { Button } from "@/components/ui/button";
import { BOOKING_META, isBookingStatus } from "@/lib/activities/categories";
import { formatDuration } from "@/lib/activities/schedule";
import { legMinutes, legTimes } from "@/lib/transportations/legs";
import { legRoute, transportMeta } from "@/lib/transportations/types";
import { formatLocalMoment } from "@/lib/zoned-time";

type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  tripId: string;
  leg: {
    id: string;
    type: string;
    origin_name: string;
    destination_name: string;
    departs_at: string;
    departs_timezone: string;
    arrives_at: string;
    arrives_timezone: string;
    carrier: string | null;
    service_number: string | null;
    booking_ref: string | null;
    booking_url: string | null;
    booking_status: string;
    departure_detail: string | null;
    arrival_detail: string | null;
    notes: string | null;
    transportation_participants: { traveler_id: string; seat: string | null }[];
  };
  travelers: Traveler[];
  files: { id: string; original_name: string; mime_type: string; size_bytes: number }[];
  editable: boolean;
  /** Small label above the route, e.g. "Sale en 2 h" on Hoy. */
  eyebrow?: React.ReactNode;
};

/** One leg: route, both local times, duration, details, seats and tickets. */
export function TransportCard({ tripId, leg, travelers, files, editable, eyebrow }: Props) {
  const meta = transportMeta(leg.type);
  const Icon = meta.icon;
  const { dayShift } = legTimes(leg);
  const booking = isBookingStatus(leg.booking_status) ? BOOKING_META[leg.booking_status] : null;
  const rows = leg.transportation_participants;
  const people = rows.length > 0 ? rows.flatMap((p) => travelers.find((t) => t.id === p.traveler_id) ?? []) : travelers;
  const seats = rows.filter((p) => p.seat);
  const service = [leg.carrier, leg.service_number].filter(Boolean).join(" · ");
  const titleId = `leg-${leg.id}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow && <span className="text-sm text-muted-foreground">{eyebrow}</span>}
          <h3 id={titleId} className="text-lg leading-tight font-bold">
            {legRoute(leg)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {meta.label}
            {service ? ` · ${service}` : ""}
          </p>
        </div>
        {booking?.badge && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${booking.className}`}>{booking.badge}</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{meta.departs}</dt>
          <dd className="font-medium">{formatLocalMoment(leg.departs_at, leg.departs_timezone)}</dd>
          {leg.departure_detail && <dd className="text-xs text-muted-foreground">{leg.departure_detail}</dd>}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{meta.arrives}</dt>
          <dd className="font-medium">
            {formatLocalMoment(leg.arrives_at, leg.arrives_timezone)}
            {dayShift > 0 && <span className="ml-1 text-xs text-warning-foreground">(+{dayShift})</span>}
          </dd>
          {leg.arrival_detail && <dd className="text-xs text-muted-foreground">{leg.arrival_detail}</dd>}
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDuration(legMinutes(leg))}
            {leg.departs_timezone !== leg.arrives_timezone ? " · horas locales" : ""}
          </span>
          {people.length > 0 && seats.length === 0 && <TravelerStack travelers={people} max={4} />}
        </div>
      </dl>

      {seats.length > 0 && (
        <ul aria-label="Asientos" className="flex flex-wrap gap-2">
          {people.map((t) => {
            const seat = rows.find((p) => p.traveler_id === t.id)?.seat;
            return (
              <li key={t.id} className="flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm">
                <TravelerAvatar traveler={t} size="sm" />
                {t.name.split(" ")[0]}
                {seat && <strong className="font-mono">{seat}</strong>}
              </li>
            );
          })}
        </ul>
      )}

      {leg.booking_ref && (
        <p className="text-sm">
          Referencia: <strong className="font-mono">{leg.booking_ref}</strong>
        </p>
      )}
      {leg.notes && <p className="text-sm whitespace-pre-line text-foreground/80">{leg.notes}</p>}

      {files.length > 0 && (
        <ul aria-label="Boletos" className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.id}>
              <FileRow tripId={tripId} file={file} />
            </li>
          ))}
        </ul>
      )}

      {(leg.booking_url || editable) && (
        <div className="flex flex-wrap gap-2">
          {leg.booking_url && (
            <Button asChild size="lg" variant="outline" className="h-11 flex-1">
              <a href={leg.booking_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Ver reserva
              </a>
            </Button>
          )}
          {editable && (
            <Button asChild size="lg" variant="outline" className="h-11 flex-1">
              <Link href={`/viajes/${tripId}/transporte/${leg.id}`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
