import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";

import { AccommodationForm } from "@/components/accommodations/accommodation-form";
import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { UploadForm } from "@/components/files/upload-form";
import { getAccommodation } from "@/lib/accommodations/queries";
import { getAttachTargets, getTripFiles } from "@/lib/files/queries";
import { listTimeZones } from "@/lib/time-zones";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

import { updateAccommodation } from "../actions";
import { DeleteAccommodationButton } from "./delete-accommodation-button";

export async function generateMetadata({
  params,
}: PageProps<"/viajes/[id]/hospedajes/[accommodationId]">): Promise<Metadata> {
  const { id, accommodationId } = await params;
  const stay = await getAccommodation(id, accommodationId);
  return { title: stay ? `${stay.name} · Travio` : "Hospedaje · Travio" };
}

export default async function EditAccommodationPage({
  params,
  searchParams,
}: PageProps<"/viajes/[id]/hospedajes/[accommodationId]">) {
  const { id, accommodationId } = await params;
  const { participantes, nuevo } = await searchParams;
  const [trip, role, stay, stops, travelers, tripFiles, targets] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getAccommodation(id, accommodationId),
    getStops(id),
    getTravelers(id),
    getTripFiles(id),
    getAttachTargets(id),
  ]);

  if (!trip || !stay) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/hospedajes`);

  const files = tripFiles.filter((f) => f.accommodation_id === stay.id);
  const checkIn = instantToZonedTime(stay.check_in_at, stay.timezone);
  const checkOut = instantToZonedTime(stay.check_out_at, stay.timezone);
  const backHref = `/viajes/${trip.id}/hospedajes`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Hospedajes
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{stay.name}</h1>
      </header>

      {nuevo === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Hospedaje guardado. Adjunta la reserva abajo para tenerla a la mano.
        </p>
      )}
      {participantes === "error" && (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
          El hospedaje se guardó, pero no pudimos guardar quién se queda. Revísalo y guarda de nuevo.
        </p>
      )}

      <section aria-labelledby="stay-files" className="flex flex-col gap-3">
        <div>
          <h2 id="stay-files" className="font-semibold">
            Reserva
          </h2>
          <p className="text-sm text-muted-foreground">Aparece en Hoy y en Documentos. Solo la ve quien tiene acceso al viaje.</p>
        </div>
        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((file) => (
              <li key={file.id}>
                <FileRow tripId={trip.id} file={file} actions={<EditFileButton tripId={trip.id} file={file} targets={targets} />} />
              </li>
            ))}
          </ul>
        )}
        <UploadForm
          tripId={trip.id}
          accommodationId={stay.id}
          defaultType="hotel"
          title={files.length > 0 ? "Agregar otro archivo" : "Adjuntar reserva"}
        />
      </section>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Datos del hospedaje</h2>
        <AccommodationForm
          action={updateAccommodation.bind(null, trip.id, stay.id)}
          initialValues={{
            name: stay.name,
            trip_stop_id: stay.trip_stop_id ?? "",
            timezone: stay.timezone,
            check_in_date: checkIn.date,
            check_in_time: checkIn.time,
            check_out_date: checkOut.date,
            check_out_time: checkOut.time,
            address: stay.address ?? "",
            booking_status: stay.booking_status,
            booking_ref: stay.booking_ref ?? "",
            booking_url: stay.booking_url ?? "",
            cost_amount: stay.cost_amount === null ? "" : String(stay.cost_amount),
            cost_currency: stay.cost_currency ?? trip.currency,
            notes: stay.notes ?? "",
            google_place_id: stay.google_place_id ?? "",
            lat: stay.lat === null ? "" : String(stay.lat),
            lng: stay.lng === null ? "" : String(stay.lng),
            // No rows means everyone: show every traveler checked.
            participants:
              stay.accommodation_participants.length > 0
                ? stay.accommodation_participants.map((p) => p.traveler_id)
                : travelers.map((t) => t.id),
          }}
          stops={stops}
          travelers={travelers}
          timeZones={listTimeZones()}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar cambios"
          cancelHref={backHref}
        />
      </div>

      <section aria-labelledby="remove-stay" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-stay" className="font-semibold">
          Borrar hospedaje
        </h2>
        <DeleteAccommodationButton tripId={trip.id} accommodationId={stay.id} title={stay.name} />
      </section>
    </main>
  );
}
