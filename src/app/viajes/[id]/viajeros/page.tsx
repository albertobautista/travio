import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TravelerAvatar } from "@/components/travelers/traveler-avatar";
import { TravelerForm } from "@/components/travelers/traveler-form";
import { Button } from "@/components/ui/button";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMembers, getMyTripRole, getTrip } from "@/lib/trips/queries";

import { AccessSection } from "./access-section";
import { createTraveler } from "./actions";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/viajeros">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Viajeros · ${trip.name} · Travio` : "Viajeros · Travio" };
}

export default async function TravelersPage({ params }: PageProps<"/viajes/[id]/viajeros">) {
  const { id } = await params;
  const [trip, role, travelers, members] = await Promise.all([getTrip(id), getMyTripRole(id), getTravelers(id), getMembers(id)]);
  if (!trip) notFound();

  const editable = canEdit(role);
  const memberName = new Map(members.map((m) => [m.user_id, m.profiles?.display_name ?? "Sin nombre"]));
  const linked = new Set(travelers.map((t) => t.user_id).filter(Boolean));
  const linkable = members.filter((m) => !linked.has(m.user_id)).map((m) => ({ user_id: m.user_id, name: memberName.get(m.user_id)! }));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 size-11">
          <Link href={`/viajes/${trip.id}`} aria-label={`Volver a ${trip.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Viajeros</h1>
          <p className="truncate text-sm text-muted-foreground lg:hidden">{trip.name}</p>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Quiénes van al viaje. No necesitan cuenta
        {role === "owner" ? "; si quieres que alguien vea el viaje desde su teléfono, invítalo abajo." : "."}
      </p>

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {travelers.map((t) => {
          const row = (
            <>
              <TravelerAvatar traveler={t} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.user_id ? `Cuenta de ${memberName.get(t.user_id) ?? "Travio"}` : "Sin cuenta"}
                </span>
              </span>
            </>
          );
          return (
            <li key={t.id}>
              {editable ? (
                <Link href={`/viajes/${trip.id}/viajeros/${t.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted">
                  {row}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-4 py-2">{row}</div>
              )}
            </li>
          );
        })}
        {travelers.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Todavía no hay viajeros.</li>}
      </ul>

      {editable && (
        <section aria-labelledby="add-traveler" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="add-traveler" className="font-semibold">
            Agregar viajero
          </h2>
          <TravelerForm
            action={createTraveler.bind(null, trip.id)}
            accounts={linkable}
            submitLabel="Agregar"
            pendingLabel="Agregando…"
          />
        </section>
      )}

      <AccessSection trip={trip} role={role} travelers={travelers} />
    </main>
  );
}
