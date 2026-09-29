import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FolderLock } from "lucide-react";

import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { UploadForm } from "@/components/files/upload-form";
import { Button } from "@/components/ui/button";
import { getActivities } from "@/lib/activities/queries";
import { getTripFiles } from "@/lib/files/queries";
import { DOCUMENT_TYPES, isDocumentType, type DocumentType } from "@/lib/files/rules";
import { canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";
import { instantToZonedTime } from "@/lib/zoned-time";

const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/** "29 sep · 21:00 · Ir al jardín", in the activity's local time. */
function activityLabel(a: { title: string; starts_at: string; timezone: string }) {
  const local = instantToZonedTime(a.starts_at, a.timezone);
  const day = shortDate.format(new Date(`${local.date}T00:00:00Z`)).replace(".", "");
  return `${day} · ${local.time} · ${a.title}`;
}

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/documentos">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Documentos · ${trip.name} · Travio` : "Documentos · Travio" };
}

/**
 * The trip's document wallet. Grouping by type is only a view: each file
 * stays attached to its activity (or the trip), not to a folder.
 */
export default async function DocumentsPage({ params }: PageProps<"/viajes/[id]/documentos">) {
  const { id } = await params;
  const [trip, role, files, activities] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTripFiles(id),
    getActivities(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);

  const groups = (Object.keys(DOCUMENT_TYPES) as DocumentType[])
    .map((type) => ({
      type,
      files: files.filter((f) => (isDocumentType(f.document_type) ? f.document_type : "other") === type),
    }))
    .filter((g) => g.files.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
          <Link href={`/viajes/${trip.id}`} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderLock className="size-3.5 shrink-0" aria-hidden="true" />
            Privados: solo las personas con acceso a {trip.name} pueden verlos.
          </p>
        </div>
      </header>

      {editable && (
        <UploadForm tripId={trip.id} activities={activities.map((a) => ({ id: a.id, label: activityLabel(a) }))} />
      )}

      {groups.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <FolderLock className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Aún no hay documentos</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {editable
              ? "Sube boletos, reservas, pases de abordar o seguros para tenerlos a la mano durante el viaje."
              : "Cuando alguien suba boletos o reservas, aparecerán aquí."}
          </p>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.type} aria-labelledby={`docs-${group.type}`} className="flex flex-col gap-2">
            <h2 id={`docs-${group.type}`} className="font-semibold">
              {DOCUMENT_TYPES[group.type]} <span className="font-normal text-muted-foreground">({group.files.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {group.files.map((file) => (
                <li key={file.id}>
                  <FileRow
                    tripId={trip.id}
                    file={file}
                    meta={
                      file.activities ? (
                        editable ? (
                          <Link href={`/viajes/${trip.id}/actividades/${file.activities.id}`} className="underline">
                            {file.activities.title}
                          </Link>
                        ) : (
                          file.activities.title
                        )
                      ) : file.accommodations ? (
                        <Link href={`/viajes/${trip.id}/hospedajes${editable ? `/${file.accommodations.id}` : ""}`} className="underline">
                          {file.accommodations.name}
                        </Link>
                      ) : null
                    }
                    actions={
                      editable ? <EditFileButton tripId={trip.id} file={file} /> : null
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
