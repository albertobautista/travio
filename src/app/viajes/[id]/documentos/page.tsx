import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderLock, Lock } from "lucide-react";

import { EditFileButton } from "@/components/files/edit-file-button";
import { FileRow } from "@/components/files/file-row";
import { UploadForm } from "@/components/files/upload-form";
import { UploadSheet } from "@/components/files/upload-sheet";
import { OfflineDocuments } from "@/components/offline/offline-documents";
import { getAccommodations } from "@/lib/accommodations/queries";
import { stayForToday } from "@/lib/accommodations/stays";
import { activityDate } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { getAttachTargets, getTripFiles, type TripFile } from "@/lib/files/queries";
import { DOCUMENT_TYPES, isDocumentType, type DocumentType } from "@/lib/files/rules";
import { legsForToday } from "@/lib/transportations/legs";
import { getTransportations } from "@/lib/transportations/queries";
import { getTripStatus } from "@/lib/trips/dates";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/documentos">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Documentos · ${trip.name} · Travio` : "Documentos · Travio" };
}

const typeOf = (f: TripFile): DocumentType => (isDocumentType(f.document_type) ? f.document_type : "other");

/**
 * The trip's document wallet. Grouping by type is only a view: each file
 * stays attached to its activity (or the trip), not to a folder.
 *
 * Order, for use on the road: what's needed today first, then everything by
 * type (filterable with ?tipo=). Uploading lives behind "Subir".
 */
export default async function DocumentsPage({ params, searchParams }: PageProps<"/viajes/[id]/documentos">) {
  const { id } = await params;
  const { tipo } = await searchParams;
  const [trip, role, files, targets, stops, activities, stays, legs] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getTripFiles(id),
    getAttachTargets(id),
    getStops(id),
    getActivities(id),
    getAccommodations(id),
    getTransportations(id),
  ]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const filter = isDocumentType(tipo) ? tipo : null;
  const base = `/viajes/${trip.id}`;

  // "Para hoy": tickets for today's activities, tonight's stay and today's legs.
  const now = new Date();
  const { today } = resolveTripNow(stops, now);
  const forToday = new Set<string>();
  if (!filter && getTripStatus(trip.start_date, trip.end_date, today) === "active") {
    const activityIds = new Set(activities.filter((a) => activityDate(a) === today).map((a) => a.id));
    const stayId = stayForToday(stays, now, today)?.id;
    const legIds = new Set(legsForToday(legs, now, today).map((l) => l.id));
    for (const f of files) {
      if ((f.activity_id && activityIds.has(f.activity_id)) || (f.accommodation_id && f.accommodation_id === stayId) || (f.transportation_id && legIds.has(f.transportation_id))) {
        forToday.add(f.id);
      }
    }
  }

  const types = (Object.keys(DOCUMENT_TYPES) as DocumentType[])
    .map((type) => ({ type, count: files.filter((f) => typeOf(f) === type).length }))
    .filter((t) => t.count > 0);
  const groups = types
    .filter((t) => !filter || t.type === filter)
    .map(({ type }) => ({ type, files: files.filter((f) => typeOf(f) === type) }));

  const row = (file: TripFile) => (
    <li key={file.id}>
      <FileRow
        tripId={trip.id}
        file={file}
        meta={
          file.activities ? (
            editable ? (
              <Link href={`${base}/actividades/${file.activities.id}`} className="underline">
                {file.activities.title}
              </Link>
            ) : (
              file.activities.title
            )
          ) : file.accommodations ? (
            <Link href={`${base}/hospedajes${editable ? `/${file.accommodations.id}` : ""}`} className="underline">
              {file.accommodations.name}
            </Link>
          ) : file.transportations ? (
            <Link href={`${base}/transporte${editable ? `/${file.transportations.id}` : ""}`} className="underline">
              {file.transportations.origin_name} → {file.transportations.destination_name}
            </Link>
          ) : null
        }
        actions={editable ? <EditFileButton tripId={trip.id} file={file} targets={targets} /> : null}
      />
    </li>
  );
  const chip = (active: boolean) =>
    "pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors " +
    (active ? "border-foreground bg-foreground font-semibold text-background" : "bg-card text-foreground/80 hover:bg-muted");

  return (
    <main className="stagger mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Documentos</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            Solo para quienes tienen acceso a {trip.name}
          </p>
        </div>
        {editable && (
          <UploadSheet>
            <UploadForm tripId={trip.id} targets={targets} bare />
          </UploadSheet>
        )}
      </header>

      <OfflineDocuments tripId={trip.id} files={files.map((f) => ({ id: f.id, name: f.original_name, size: f.size_bytes }))} />

      {files.length === 0 ? (
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
        <>
          {types.length > 1 && (
            <nav aria-label="Tipo de documento" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
              <ul className="flex w-max gap-2">
                <li>
                  <Link href={`${base}/documentos`} aria-current={!filter ? "true" : undefined} className={chip(!filter)}>
                    Todos <span className={!filter ? "text-background/70" : "text-muted-foreground"}>{files.length}</span>
                  </Link>
                </li>
                {types.map((t) => (
                  <li key={t.type}>
                    <Link href={`${base}/documentos?tipo=${t.type}`} aria-current={filter === t.type ? "true" : undefined} className={chip(filter === t.type)}>
                      {DOCUMENT_TYPES[t.type]}{" "}
                      <span className={filter === t.type ? "text-background/70" : "text-muted-foreground"}>{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {forToday.size > 0 && (
            <section aria-labelledby="docs-today" className="flex flex-col gap-2">
              <h2 id="docs-today" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Para hoy
              </h2>
              <ul className="flex flex-col gap-2">{files.filter((f) => forToday.has(f.id)).map(row)}</ul>
            </section>
          )}

          {groups.map((group) => (
            <section key={group.type} aria-labelledby={`docs-${group.type}`} className="flex flex-col gap-2">
              <h2 id={`docs-${group.type}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {DOCUMENT_TYPES[group.type]} · {group.files.length}
              </h2>
              <ul className="flex flex-col gap-2">{group.files.map(row)}</ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
