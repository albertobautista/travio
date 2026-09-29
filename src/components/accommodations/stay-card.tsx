import Link from "next/link";
import { BedDouble, ExternalLink, MapPin, Navigation, Pencil } from "lucide-react";

import { FileRow } from "@/components/files/file-row";
import { TravelerStack } from "@/components/travelers/traveler-avatar";
import { Button } from "@/components/ui/button";
import { countNights, directionsUrl, formatStayMoment } from "@/lib/accommodations/stays";
import { BOOKING_META, isBookingStatus } from "@/lib/activities/categories";

type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  tripId: string;
  stay: {
    id: string;
    name: string;
    address: string | null;
    check_in_at: string;
    check_out_at: string;
    timezone: string;
    booking_ref: string | null;
    booking_url: string | null;
    booking_status: string;
    notes: string | null;
    accommodation_participants: { traveler_id: string }[];
  };
  /** Everyone on the trip; the stay's participants are picked from here. */
  travelers: Traveler[];
  files: { id: string; original_name: string; mime_type: string; size_bytes: number }[];
  editable: boolean;
  /** Small label above the name, e.g. "Esta noche" on Hoy. */
  eyebrow?: string;
};

/** One accommodation: dates, nights, who stays, directions, reservation and its files. */
export function StayCard({ tripId, stay, travelers, files, editable, eyebrow }: Props) {
  const nights = countNights(stay);
  const booking = isBookingStatus(stay.booking_status) ? BOOKING_META[stay.booking_status] : null;
  const ids = stay.accommodation_participants.map((p) => p.traveler_id);
  const people = ids.length > 0 ? travelers.filter((t) => ids.includes(t.id)) : travelers;
  const directions = directionsUrl(stay.address ? `${stay.name}, ${stay.address}` : null);
  const titleId = `stay-${stay.id}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <BedDouble className="size-6" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {eyebrow && <span className="text-sm text-muted-foreground">{eyebrow}</span>}
          <h3 id={titleId} className="text-lg leading-tight font-bold">
            {stay.name}
          </h3>
          {stay.address && (
            <p className="flex items-start gap-1 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{stay.address}</span>
            </p>
          )}
        </div>
        {booking?.badge && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${booking.className}`}>{booking.badge}</span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Llegada</dt>
          <dd className="font-medium">{formatStayMoment(stay.check_in_at, stay.timezone)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Salida</dt>
          <dd className="font-medium">{formatStayMoment(stay.check_out_at, stay.timezone)}</dd>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{nights === 1 ? "1 noche" : `${nights} noches`}</span>
          {people.length > 0 && <TravelerStack travelers={people} max={4} />}
        </div>
      </dl>

      {stay.booking_ref && (
        <p className="text-sm">
          Referencia: <strong className="font-mono">{stay.booking_ref}</strong>
        </p>
      )}
      {stay.notes && <p className="text-sm whitespace-pre-line text-foreground/80">{stay.notes}</p>}

      {files.length > 0 && (
        <ul aria-label="Reservas" className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.id}>
              <FileRow tripId={tripId} file={file} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {directions && (
          <Button asChild size="lg" className="h-11 flex-1">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" />
              Cómo llegar
            </a>
          </Button>
        )}
        {stay.booking_url && (
          <Button asChild size="lg" variant="outline" className="h-11 flex-1">
            <a href={stay.booking_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Ver reserva
            </a>
          </Button>
        )}
        {editable && (
          <Button asChild size="lg" variant="outline" className="h-11 flex-1">
            <Link href={`/viajes/${tripId}/hospedajes/${stay.id}`}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
