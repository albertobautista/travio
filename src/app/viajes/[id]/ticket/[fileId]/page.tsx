import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, CalendarDays, ChevronLeft, Download, ExternalLink, FileText, ImageIcon, Lock, MapPin, Navigation } from "lucide-react";

import { fileHref } from "@/components/files/file-row";
import { PlacePhoto } from "@/components/maps/place-photo";
import { Button } from "@/components/ui/button";
import { getAccommodations } from "@/lib/accommodations/queries";
import { BOOKING_META, CATEGORY_META, isBookingStatus, isCategory } from "@/lib/activities/categories";
import { getActivities } from "@/lib/activities/queries";
import { formatDuration, formatTimeRange } from "@/lib/activities/schedule";
import { DOCUMENT_TYPES, formatFileSize, isDocumentType } from "@/lib/files/rules";
import { getTripFiles } from "@/lib/files/queries";
import { directionsUrl } from "@/lib/maps/directions";
import { formatLegTimes } from "@/lib/transportations/legs";
import { getTransportations } from "@/lib/transportations/queries";
import { legRoute, transportMeta } from "@/lib/transportations/types";
import { getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/ticket/[fileId]">): Promise<Metadata> {
  const { id, fileId } = await params;
  const file = (await getTripFiles(id)).find((f) => f.id === fileId);
  return { title: file ? `${file.original_name} · Travio` : "Ticket · Travio" };
}

const longDate = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function formatLongDate(date: string) {
  const s = longDate.format(new Date(`${date}T00:00:00Z`)).replace(/\./g, "").replace(/ de /g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Images the browser can show inline (HEIC only works in Safari, so it isn't previewed). */
const PREVIEWABLE_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Detail = {
  title: string;
  chips: { label: string; className: string }[];
  when: { date: string; time: string } | null;
  place: { name: string | null; address: string | null; lat: number | null; lng: number | null; placeId: string | null } | null;
  ref: { label: string; value: string } | null;
  extra: string | null;
  back: { href: string; label: string };
  photo: boolean;
};

/**
 * A document with what it's for, ready to show at the door (the mockup's
 * "Detalle y ticket"): the activity, stay or trip it belongs to, when and
 * where, the reference, and the file itself previewed in the page. The
 * preview loads through documentos/[fileId] like any open, so access is
 * checked and the signed URL never appears in the HTML.
 */
export default async function TicketPage({ params }: PageProps<"/viajes/[id]/ticket/[fileId]">) {
  const { id, fileId } = await params;
  const [trip, files, activities, legs, stays] = await Promise.all([
    getTrip(id),
    getTripFiles(id),
    getActivities(id),
    getTransportations(id),
    getAccommodations(id),
  ]);
  const file = files.find((f) => f.id === fileId);
  if (!trip || !file) notFound();
  const base = `/viajes/${trip.id}`;

  const activity = file.activity_id ? activities.find((a) => a.id === file.activity_id) : undefined;
  const leg = file.transportation_id ? legs.find((l) => l.id === file.transportation_id) : undefined;
  const stay = file.accommodation_id ? stays.find((s) => s.id === file.accommodation_id) : undefined;

  const detail: Detail = (() => {
    if (activity) {
      const cat = isCategory(activity.category) ? CATEGORY_META[activity.category] : CATEGORY_META.other;
      const booking = isBookingStatus(activity.booking_status) ? BOOKING_META[activity.booking_status] : null;
      const start = new Date(activity.starts_at);
      const date = instantToZonedTime(start, activity.timezone).date;
      return {
        title: activity.title,
        chips: [{ label: cat.label, className: cat.className }, ...(booking?.badge ? [{ label: booking.badge, className: booking.className }] : [])],
        when: {
          date,
          time: `${formatTimeRange(start, activity.duration_minutes, activity.timezone)} (${formatDuration(activity.duration_minutes)})`,
        },
        place:
          activity.location_name || activity.address
            ? { name: activity.location_name, address: activity.address, lat: activity.lat, lng: activity.lng, placeId: activity.google_place_id }
            : null,
        ref: activity.reservation_ref ? { label: "Referencia", value: activity.reservation_ref } : null,
        extra: null,
        back: { href: `${base}/itinerario?dia=${date}`, label: "Itinerario" },
        photo: Boolean(activity.location_name || activity.google_place_id),
      };
    }
    if (leg) {
      const meta = transportMeta(leg.type);
      const departs = instantToZonedTime(leg.departs_at, leg.departs_timezone);
      const seats = leg.transportation_participants.map((p) => p.seat).filter(Boolean);
      return {
        title: legRoute(leg),
        chips: [{ label: meta.label, className: "bg-secondary text-secondary-foreground" }],
        when: { date: departs.date, time: formatLegTimes(leg) },
        place: { name: leg.origin_name, address: leg.departure_detail, lat: null, lng: null, placeId: null },
        ref: leg.booking_ref ? { label: "Reserva", value: leg.booking_ref } : null,
        extra: [[leg.carrier, leg.service_number].filter(Boolean).join(" "), seats.length ? `Asiento ${seats.join(", ")}` : ""]
          .filter(Boolean)
          .join(" · ") || null,
        back: { href: `${base}/transporte`, label: "Transporte" },
        photo: false,
      };
    }
    if (stay) {
      const checkIn = instantToZonedTime(stay.check_in_at, stay.timezone);
      const checkOut = instantToZonedTime(stay.check_out_at, stay.timezone);
      return {
        title: stay.name,
        chips: [{ label: "Hospedaje", className: "bg-secondary text-secondary-foreground" }],
        when: { date: checkIn.date, time: `Check-in ${checkIn.time} · check-out ${formatLongDate(checkOut.date).toLowerCase()} ${checkOut.time}` },
        place: { name: stay.name, address: stay.address, lat: stay.lat, lng: stay.lng, placeId: stay.google_place_id },
        ref: stay.booking_ref ? { label: "Reserva", value: stay.booking_ref } : null,
        extra: null,
        back: { href: `${base}/hospedajes`, label: "Hospedajes" },
        photo: true,
      };
    }
    return {
      title: file.original_name,
      chips: [{ label: isDocumentType(file.document_type) ? DOCUMENT_TYPES[file.document_type] : "Documento", className: "bg-secondary text-secondary-foreground" }],
      when: null,
      place: null,
      ref: null,
      extra: "Documento del viaje",
      back: { href: `${base}/documentos`, label: "Documentos" },
      photo: false,
    };
  })();

  // Everything else attached to the same thing (a ticket and its confirmation, say).
  const siblings = files.filter(
    (f) =>
      f.id !== file.id &&
      ((activity && f.activity_id === activity.id) || (leg && f.transportation_id === leg.id) || (stay && f.accommodation_id === stay.id)),
  );
  const directions = detail.place
    ? directionsUrl({ name: detail.place.name, address: detail.place.address, lat: detail.place.lat, lng: detail.place.lng, google_place_id: detail.place.placeId })
    : null;
  const isPdf = file.mime_type === "application/pdf";
  const canPreviewImage = PREVIEWABLE_IMAGES.has(file.mime_type);
  const HeaderIcon = leg ? transportMeta(leg.type).icon : stay ? BedDouble : FileText;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-6">
      <div className="relative">
        {detail.photo && detail.place ? (
          <PlacePhoto
            name={detail.place.name ?? detail.title}
            query={[detail.place.name, detail.place.address].filter(Boolean).join(", ")}
            placeId={detail.place.placeId}
            lat={detail.place.lat}
            lng={detail.place.lng}
            radius={5_000}
            maxWidth={800}
            maxHeight={400}
            className="h-48 sm:mx-4 sm:mt-4 sm:rounded-[20px]"
            fallback={<div className="flex size-full items-center justify-center bg-secondary text-primary" aria-hidden="true"><HeaderIcon className="size-10" /></div>}
          />
        ) : (
          <div className="flex h-28 items-center justify-center bg-secondary text-primary sm:mx-4 sm:mt-4 sm:rounded-[20px]" aria-hidden="true">
            <HeaderIcon className="size-10" />
          </div>
        )}
        <Link
          href={detail.back.href}
          aria-label={`Volver a ${detail.back.label}`}
          className="absolute top-3 left-3 flex size-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow hover:bg-card sm:top-7 sm:left-7"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            {detail.chips.map((c) => (
              <span key={c.label} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.className}`}>
                {c.label}
              </span>
            ))}
          </div>
        </header>

        {(detail.when || detail.place || detail.extra) && (
          <div className="flex flex-col gap-2.5 text-sm">
            {detail.when && (
              <p className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-[18px] shrink-0 text-foreground/70" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="font-medium">{formatLongDate(detail.when.date)}</span>
                  <span className="text-muted-foreground">{detail.when.time}</span>
                </span>
              </p>
            )}
            {detail.place && (
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-[18px] shrink-0 text-foreground/70" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="font-medium">{[detail.place.name, detail.place.address].filter(Boolean).join(" · ")}</span>
                  {directions && (
                    <a href={directions} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-primary hover:underline">
                      Abrir en Google Maps
                    </a>
                  )}
                </span>
              </p>
            )}
            {detail.extra && <p className="pl-7 text-muted-foreground">{detail.extra}</p>}
          </div>
        )}

        <section aria-label="Ticket" className="overflow-hidden rounded-[18px] border bg-card">
          <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
            {isPdf ? <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" /> : <ImageIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{file.original_name}</span>
              <span className="text-xs text-muted-foreground">
                {isPdf ? "PDF" : "Imagen"} · {formatFileSize(file.size_bytes)}
              </span>
            </span>
            {detail.ref && (
              <span className="flex shrink-0 flex-col items-end text-xs text-muted-foreground">
                {detail.ref.label}
                <strong className="font-mono text-sm text-foreground">{detail.ref.value}</strong>
              </span>
            )}
          </div>
          {canPreviewImage ? (
            // Plain <img>: the src redirects to a short-lived signed URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileHref(trip.id, file.id)} alt={`Vista previa de ${file.original_name}`} className="max-h-[70vh] w-full bg-white object-contain" />
          ) : isPdf ? (
            <iframe src={fileHref(trip.id, file.id)} title={`Vista previa de ${file.original_name}`} className="h-[65vh] w-full bg-white" />
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Este formato no se puede previsualizar aquí. Ábrelo para verlo.</p>
          )}
          <div className="grid grid-cols-2 gap-2 border-t p-3">
            <Button asChild size="lg" variant="outline" className="h-11">
              <a href={fileHref(trip.id, file.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Abrir
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11">
              <a href={fileHref(trip.id, file.id, true)}>
                <Download aria-hidden="true" />
                Descargar
              </a>
            </Button>
          </div>
        </section>

        {siblings.length > 0 && (
          <section aria-labelledby="siblings" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 id="siblings" className="font-semibold">
                Otros archivos ({siblings.length})
              </h2>
              <Link href={`${base}/documentos`} className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {siblings.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border bg-card p-2 pl-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    {f.mime_type === "application/pdf" ? <FileText className="size-5" aria-hidden="true" /> : <ImageIcon className="size-5" aria-hidden="true" />}
                  </span>
                  <Link href={`${base}/ticket/${f.id}`} className="flex min-w-0 flex-1 flex-col py-1 hover:underline">
                    <span className="truncate text-sm font-medium">{f.original_name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(f.size_bytes)}</span>
                  </Link>
                  <Button asChild variant="ghost" size="icon" className="size-11 text-muted-foreground">
                    <a href={fileHref(trip.id, f.id, true)} aria-label={`Descargar ${f.original_name}`}>
                      <Download aria-hidden="true" />
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          Privado: solo las personas con acceso a {trip.name} pueden verlo.
        </p>

        {directions && (
          <Button asChild size="lg" className="h-12">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" />
              Cómo llegar
            </a>
          </Button>
        )}
      </div>
    </main>
  );
}
