import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ActivityForm } from "@/components/activities/activity-form";
import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { UploadForm } from "@/components/files/upload-form";
import { getActivities, getActivity } from "@/lib/activities/queries";
import { getAttachTargets, getTripFiles } from "@/lib/files/queries";
import { listTimeZones } from "@/lib/time-zones";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

import { updateActivity } from "../actions";
import { DeleteActivityButton } from "./delete-activity-button";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/actividades/[activityId]">): Promise<Metadata> {
  const { id, activityId } = await params;
  const activity = await getActivity(id, activityId);
  return { title: activity ? `${activity.title} · Travio` : "Actividad · Travio" };
}

export default async function EditActivityPage({ params, searchParams }: PageProps<"/viajes/[id]/actividades/[activityId]">) {
  const { id, activityId } = await params;
  // Set when the activity saved but its participants didn't (see saveParticipants).
  const participantsFailed = (await searchParams).participantes === "error";
  const [trip, role, activity, stops, activities, travelers, tripFiles, targets] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getActivity(id, activityId),
    getStops(id),
    getActivities(id),
    getTravelers(id),
    getTripFiles(id),
    getAttachTargets(id),
  ]);

  if (!trip || !activity) notFound();
  const files = tripFiles.filter((f) => f.activity_id === activity.id);
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/itinerario`);

  // Stored as an instant; edited as local wall time in the activity's zone.
  const local = instantToZonedTime(activity.starts_at, activity.timezone);
  const backHref = `/viajes/${trip.id}/itinerario?dia=${local.date}`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Itinerario
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar actividad</h1>
      </header>

      {participantsFailed && (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
          La actividad se guardó, pero no pudimos guardar quién va. Revísalo y guarda de nuevo.
        </p>
      )}

      <div className="rounded-2xl border bg-card p-5">
        <ActivityForm
          action={updateActivity.bind(null, trip.id, activity.id)}
          initialValues={{
            title: activity.title,
            category: activity.category,
            trip_stop_id: activity.trip_stop_id ?? "",
            timezone: activity.timezone,
            date: local.date,
            start_time: local.time,
            duration_hours: String(Math.floor(activity.duration_minutes / 60)),
            duration_minutes: String(activity.duration_minutes % 60),
            location_name: activity.location_name ?? "",
            address: activity.address ?? "",
            booking_status: activity.booking_status,
            reservation_ref: activity.reservation_ref ?? "",
            cost_amount: activity.cost_amount === null ? "" : String(activity.cost_amount),
            cost_currency: activity.cost_currency ?? trip.currency,
            external_url: activity.external_url ?? "",
            notes: activity.notes ?? "",
            google_place_id: activity.google_place_id ?? "",
            lat: activity.lat === null ? "" : String(activity.lat),
            lng: activity.lng === null ? "" : String(activity.lng),
            // No rows means everyone: show every traveler checked.
            participants:
              activity.activity_participants.length > 0
                ? activity.activity_participants.map((p) => p.traveler_id)
                : travelers.map((t) => t.id),
          }}
          stops={stops}
          travelers={travelers}
          timeZones={listTimeZones()}
          // Don't warn about overlapping with itself.
          otherActivities={activities.filter((a) => a.id !== activity.id)}
          minDate={trip.start_date ?? undefined}
          maxDate={trip.end_date ?? undefined}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          cancelHref={backHref}
        />
      </div>

      <section aria-labelledby="activity-files" className="flex flex-col gap-3">
        <div>
          <h2 id="activity-files" className="font-semibold">
            Boletos y reservas
          </h2>
          <p className="text-sm text-muted-foreground">Aparecen en Hoy y en Documentos. Solo los ve quien tiene acceso al viaje.</p>
        </div>
        {files.length > 0 && (
          <ul className="flex flex-col gap-2">
            {files.map((file) => (
              <li key={file.id}>
                <FileRow
                  tripId={trip.id}
                  file={file}
                  actions={<EditFileButton tripId={trip.id} file={file} targets={targets} />}
                />
              </li>
            ))}
          </ul>
        )}
        <UploadForm
          tripId={trip.id}
          activityId={activity.id}
          defaultType={activity.category === "tour" ? "tour" : "ticket"}
          title={files.length > 0 ? "Agregar más archivos" : "Adjuntar boletos o reservas"}
        />
      </section>

      <section aria-labelledby="remove-activity" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-activity" className="font-semibold">
          Borrar actividad
        </h2>
        <DeleteActivityButton tripId={trip.id} activityId={activity.id} title={activity.title} returnDate={local.date} />
      </section>
    </main>
  );
}
