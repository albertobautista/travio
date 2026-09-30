import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";

import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { UploadForm } from "@/components/files/upload-form";
import { TransportForm } from "@/components/transportations/transport-form";
import { getAttachTargets, getTripFiles } from "@/lib/files/queries";
import { listTimeZones } from "@/lib/time-zones";
import { getTransportation } from "@/lib/transportations/queries";
import { transportMeta } from "@/lib/transportations/types";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

import { updateTransportation } from "../actions";
import { DeleteTransportationButton } from "./delete-transportation-button";

export async function generateMetadata({
  params,
}: PageProps<"/viajes/[id]/transporte/[transportationId]">): Promise<Metadata> {
  const { id, transportationId } = await params;
  const leg = await getTransportation(id, transportationId);
  return { title: leg ? `${leg.origin_name} → ${leg.destination_name} · Travio` : "Transporte · Travio" };
}

export default async function EditTransportationPage({
  params,
  searchParams,
}: PageProps<"/viajes/[id]/transporte/[transportationId]">) {
  const { id, transportationId } = await params;
  const { participantes, nuevo } = await searchParams;
  const [trip, role, leg, stops, travelers, tripFiles, targets] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTransportation(id, transportationId),
    getStops(id),
    getTravelers(id),
    getTripFiles(id),
    getAttachTargets(id),
  ]);

  if (!trip || !leg) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/transporte`);

  const files = tripFiles.filter((f) => f.transportation_id === leg.id);
  const departs = instantToZonedTime(leg.departs_at, leg.departs_timezone);
  const arrives = instantToZonedTime(leg.arrives_at, leg.arrives_timezone);
  const title = `${leg.origin_name} → ${leg.destination_name}`;
  const backHref = `/viajes/${trip.id}/transporte`;
  const rows = leg.transportation_participants;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Transporte
        </Link>
        <p className="text-sm text-muted-foreground">{transportMeta(leg.type).label}</p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>

      {nuevo === "1" && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success-foreground">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Transporte guardado. Adjunta el boleto o pase de abordar abajo.
        </p>
      )}
      {participantes === "error" && (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
          El transporte se guardó, pero no pudimos guardar quién viaja ni los asientos. Revísalo y guarda de nuevo.
        </p>
      )}

      <section aria-labelledby="leg-files" className="flex flex-col gap-3">
        <div>
          <h2 id="leg-files" className="font-semibold">
            Boletos y pases de abordar
          </h2>
          <p className="text-sm text-muted-foreground">Aparecen en Hoy y en Documentos. Solo los ve quien tiene acceso al viaje.</p>
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
          transportationId={leg.id}
          defaultType={leg.type === "flight" ? "flight" : leg.type === "train" ? "train" : "ticket"}
          title={files.length > 0 ? "Agregar más archivos" : "Adjuntar boletos"}
        />
      </section>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="mb-4 font-semibold">Datos del transporte</h2>
        <TransportForm
          action={updateTransportation.bind(null, trip.id, leg.id)}
          initialValues={{
            type: leg.type,
            origin_name: leg.origin_name,
            departs_timezone: leg.departs_timezone,
            departs_date: departs.date,
            departs_time: departs.time,
            departure_detail: leg.departure_detail ?? "",
            destination_name: leg.destination_name,
            arrives_timezone: leg.arrives_timezone,
            arrives_date: arrives.date,
            arrives_time: arrives.time,
            arrival_detail: leg.arrival_detail ?? "",
            carrier: leg.carrier ?? "",
            service_number: leg.service_number ?? "",
            booking_status: leg.booking_status,
            booking_ref: leg.booking_ref ?? "",
            booking_url: leg.booking_url ?? "",
            cost_amount: leg.cost_amount === null ? "" : String(leg.cost_amount),
            cost_currency: leg.cost_currency ?? trip.currency,
            notes: leg.notes ?? "",
            // No rows means everyone: show every traveler checked.
            participants: rows.length > 0 ? rows.map((p) => p.traveler_id) : travelers.map((t) => t.id),
            seats: Object.fromEntries(rows.filter((p) => p.seat).map((p) => [p.traveler_id, p.seat!])),
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

      <section aria-labelledby="remove-leg" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-leg" className="font-semibold">
          Borrar transporte
        </h2>
        <DeleteTransportationButton tripId={trip.id} transportationId={leg.id} title={title} />
      </section>
    </main>
  );
}
