import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TripForm } from "@/components/trips/trip-form";
import { getCoverUrls } from "@/lib/trips/cover-urls";
import { canDelete, canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";

import { updateTrip } from "./actions";
import { CoverUploader } from "./cover-uploader";
import { DeleteTripButton } from "./delete-trip-button";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/editar">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Editar ${trip.name} · Travio` : "Editar viaje · Travio" };
}

export default async function EditTripPage({ params, searchParams }: PageProps<"/viajes/[id]/editar">) {
  const { id } = await params;
  // Set by "Nuevo viaje" when the trip was created but its cover upload failed.
  const coverFailed = (await searchParams).portada === "error";
  const [trip, role] = await Promise.all([getTrip(id), getMyTripRole(id)]);

  if (!trip) notFound();
  // Viewers can open the trip but not this page. (The update itself is also
  // blocked by RLS; this just avoids showing a form that can't be saved.)
  if (!canEdit(role)) redirect(`/viajes/${trip.id}`);

  const coverUrls = await getCoverUrls([trip.cover_image_path]);
  const coverUrl = trip.cover_image_path ? (coverUrls.get(trip.cover_image_path) ?? null) : null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/viajes/${trip.id}`}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {trip.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar viaje</h1>
      </header>

      <section aria-labelledby="cover-heading" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
        <h2 id="cover-heading" className="font-semibold">
          Foto de portada
        </h2>
        {coverFailed && !coverUrl && (
          <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-foreground">
            El viaje se creó, pero no pudimos subir la foto. Inténtalo de nuevo aquí.
          </p>
        )}
        <CoverUploader tripId={trip.id} coverUrl={coverUrl} />
      </section>

      <div className="rounded-2xl border bg-card p-5">
        <TripForm
          action={updateTrip.bind(null, trip.id)}
          initialValues={{
            name: trip.name,
            start_date: trip.start_date ?? "",
            end_date: trip.end_date ?? "",
            currency: trip.currency,
            budget_amount: trip.budget_amount === null ? "" : String(trip.budget_amount),
            description: trip.description ?? "",
            ai_enabled: trip.ai_enabled ? "on" : "",
          }}
          showAiSwitch={role === "owner"}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          cancelHref={`/viajes/${trip.id}`}
        />
      </div>

      {canDelete(role) && (
        <section aria-labelledby="danger-zone" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
          <h2 id="danger-zone" className="font-semibold">
            Borrar viaje
          </h2>
          <p className="text-sm text-muted-foreground">
            Solo tú, como propietario, puedes borrarlo. Desaparece para todas las personas con acceso.
          </p>
          <DeleteTripButton tripId={trip.id} tripName={trip.name} />
        </section>
      )}
    </main>
  );
}
