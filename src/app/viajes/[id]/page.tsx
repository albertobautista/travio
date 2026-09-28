import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";

import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/initials";
import {
  formatTripDates,
  getTripDayNumber,
  getTripLengthDays,
  getTripStatus,
  todayIn,
} from "@/lib/trips/dates";
import { canEdit, getTrip, toTripRole } from "@/lib/trips/queries";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  editor: "Puede editar",
  viewer: "Solo lectura",
};

export async function generateMetadata({ params }: PageProps<"/viajes/[id]">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `${trip.name} · Travio` : "Viaje · Travio" };
}

export default async function TripPage({ params }: PageProps<"/viajes/[id]">) {
  const { id } = await params;
  const trip = await getTrip(id);

  // RLS returns nothing both when the trip doesn't exist and when the user
  // isn't a member, so we can't (and shouldn't) tell the two apart.
  if (!trip) notFound();

  const supabase = await createClient();
  const [{ data: claimsData }, { data: members }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("trip_members")
      .select("user_id, role, profiles (display_name, avatar_url)")
      .eq("trip_id", trip.id)
      .order("created_at"),
  ]);
  const myRole = toTripRole(members?.find((m) => m.user_id === claimsData?.claims.sub)?.role);

  const today = todayIn();
  const status = getTripStatus(trip.start_date, trip.end_date, today);
  const days = getTripLengthDays(trip.start_date, trip.end_date);
  const dayNumber = getTripDayNumber(trip.start_date, trip.end_date, today);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/viajes"
          className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Mis viajes
        </Link>
        {canEdit(myRole) && (
          <Button asChild variant="outline" className="h-11">
            <Link href={`/viajes/${trip.id}/editar`}>
              <Pencil aria-hidden="true" />
              Editar
            </Link>
          </Button>
        )}
      </div>

      <header className="flex flex-col gap-2 rounded-2xl bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{trip.name}</h1>
          <TripStatusBadge status={status} className="mt-2" />
        </div>
        <p className="text-foreground/80">
          {formatTripDates(trip.start_date, trip.end_date)}
          {days ? ` · ${days === 1 ? "1 día" : `${days} días`}` : ""}
          {dayNumber && days ? ` · día ${dayNumber} de ${days}` : ""}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <StatTile label="Días" value={days ?? "—"} />
        <StatTile label="Personas" value={members?.length ?? "—"} />
        <StatTile label="Moneda" value={trip.currency} />
      </dl>

      {trip.description && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Notas</h2>
          <p className="whitespace-pre-line text-foreground/80">{trip.description}</p>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">Personas con acceso</h2>
        <ul className="flex flex-col gap-3">
          {members?.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar>
                {m.profiles?.avatar_url && (
                  <AvatarImage src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" />
                )}
                <AvatarFallback>{initials(m.profiles?.display_name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {m.profiles?.display_name ?? "Sin nombre"}
                  {m.user_id === claimsData?.claims.sub ? " (tú)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {myRole === "viewer" && (
        <p className="text-center text-sm text-muted-foreground">Tienes acceso de solo lectura a este viaje.</p>
      )}
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-card p-3 text-center">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl font-bold">{value}</dd>
    </div>
  );
}
