import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TravelerForm } from "@/components/travelers/traveler-form";
import { getTravelers } from "@/lib/travelers/queries";
import { canDelete, canEdit, getMembers, getMyTripRole, getTrip } from "@/lib/trips/queries";

import { linkTravelerAccount, updateTraveler } from "../actions";
import { DeleteTravelerButton } from "./delete-traveler-button";
import { LinkAccountForm } from "./link-account-form";

export const metadata: Metadata = {
  title: "Editar viajero · Travio",
};

export default async function EditTravelerPage({ params }: PageProps<"/viajes/[id]/viajeros/[travelerId]">) {
  const { id, travelerId } = await params;
  const [trip, role, travelers, members] = await Promise.all([getTrip(id), getMyTripRole(id), getTravelers(id), getMembers(id)]);
  const traveler = travelers.find((t) => t.id === travelerId);

  if (!trip || !traveler) notFound();
  if (!canEdit(role)) redirect(`/viajes/${trip.id}/viajeros`);

  // Accounts not linked to anyone else (this traveler's own link stays available).
  const linkedElsewhere = new Set(travelers.filter((t) => t.id !== traveler.id).map((t) => t.user_id));
  const accounts = members
    .filter((m) => !linkedElsewhere.has(m.user_id))
    .map((m) => ({ user_id: m.user_id, name: m.profiles?.display_name ?? "Sin nombre" }));
  const back = `/viajes/${trip.id}/viajeros`;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={back}
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Viajeros
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Editar {traveler.name}</h1>
      </header>

      <div className="rounded-2xl border bg-card p-5">
        <TravelerForm
          action={updateTraveler.bind(null, trip.id, traveler.id)}
          initialValues={{ name: traveler.name, user_id: traveler.user_id ?? "" }}
          accounts={accounts}
          submitLabel="Guardar cambios"
          pendingLabel="Guardando…"
          cancelHref={back}
        />
      </div>

      {/* Managing access is owner-only (same rule as the database). canDelete = "is owner". */}
      {canDelete(role) && !traveler.user_id && (
        <section aria-labelledby="link-account" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <div>
            <h2 id="link-account" className="font-semibold">
              Vincular con una cuenta de Travio
            </h2>
            <p className="text-sm text-muted-foreground">
              Si {traveler.name} ya tiene cuenta, escribe su correo. Le daremos acceso al viaje y aparecerá con su foto de perfil.
            </p>
          </div>
          <LinkAccountForm action={linkTravelerAccount.bind(null, trip.id, traveler.id)} name={traveler.name} />
        </section>
      )}

      <section aria-labelledby="remove-traveler" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 id="remove-traveler" className="font-semibold">
          Quitar del viaje
        </h2>
        <p className="text-sm text-muted-foreground">
          Deja de aparecer en el viaje y en sus actividades. Si tiene cuenta, conserva su acceso.
        </p>
        <DeleteTravelerButton tripId={trip.id} travelerId={traveler.id} name={traveler.name} />
      </section>
    </main>
  );
}
