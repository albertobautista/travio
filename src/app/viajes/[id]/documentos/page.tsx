import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderLock } from "lucide-react";

import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { OfflineDocuments } from "@/components/offline/offline-documents";
import { UploadForm } from "@/components/files/upload-form";
import { getAttachTargets, getTripFiles } from "@/lib/files/queries";
import { DOCUMENT_TYPES, isDocumentType, type DocumentType } from "@/lib/files/rules";
import { canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";

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
  const [trip, role, files, targets] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTripFiles(id),
    getAttachTargets(id),
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
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FolderLock className="size-3.5 shrink-0" aria-hidden="true" />
            Privados: solo las personas con acceso a {trip.name} pueden verlos.
          </p>
        </div>
      </header>

      <OfflineDocuments tripId={trip.id} files={files.map((f) => ({ id: f.id, name: f.original_name, size: f.size_bytes }))} />

      {editable && (
        <UploadForm tripId={trip.id} targets={targets} />
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
                      ) : file.transportations ? (
                        <Link
                          href={`/viajes/${trip.id}/transporte${editable ? `/${file.transportations.id}` : ""}`}
                          className="underline"
                        >
                          {file.transportations.origin_name} → {file.transportations.destination_name}
                        </Link>
                      ) : null
                    }
                    actions={
                      editable ? <EditFileButton tripId={trip.id} file={file} targets={targets} /> : null
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
