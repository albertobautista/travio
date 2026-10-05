import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { ActiveTripCard, TripCard, type ActiveTripData, type TripCardData } from "@/components/trips/trip-card";
import { Button } from "@/components/ui/button";
import { getCoverUrls } from "@/lib/trips/cover-urls";
import { getTripDayNumber, getTripLengthDays, getTripStatus, type TripStatus } from "@/lib/trips/dates";
import { planningProgress } from "@/lib/trips/progress";
import { resolveTripNow } from "@/lib/trips/today";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mis viajes · Travio",
};

const SECTIONS: { status: Exclude<TripStatus, "active">; label: string }[] = [
  { status: "upcoming", label: "Próximos" },
  { status: "undated", label: "Sin fechas" },
  { status: "past", label: "Pasados" },
];

// Active trips first, then upcoming (soonest first), undated, and past (most recent first).
const STATUS_ORDER: Record<TripStatus, number> = { active: 0, upcoming: 1, undated: 2, past: 3 };

function compareTrips(a: TripCardData, b: TripCardData) {
  if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  const aStart = a.start_date ?? "";
  const bStart = b.start_date ?? "";
  return a.status === "past" ? bStart.localeCompare(aStart) : aStart.localeCompare(bStart);
}

export default async function TripsPage() {
  const supabase = await createClient();

  // The proxy already redirects signed-out users; this is the real check.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    redirect("/login?next=/viajes");
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  // No filter by user needed: RLS only returns trips this user is a member of.
  // Embedded selects: PostgREST follows each table's trip_id foreign key.
  const { data: rows, error } = await supabase
    .from("trips")
    .select(
      "id, name, start_date, end_date, cover_image_path, trip_stops (name, position, timezone, arrives_on, departs_on), travelers (count), activities (starts_at, timezone), transportations (departs_at, departs_timezone), accommodations (check_in_at, check_out_at, timezone)",
    );

  // One batch request signs every cover on the page.
  const coverUrls = await getCoverUrls((rows ?? []).map((t) => t.cover_image_path));

  const allTrips: (TripCardData & { today: string; city: string | null })[] = (rows ?? [])
    .map((t) => {
      // Each trip's "today" is local to where its travelers are.
      const tripNow = resolveTripNow(t.trip_stops);
      return {
        id: t.id,
        name: t.name,
        start_date: t.start_date,
        end_date: t.end_date,
        status: getTripStatus(t.start_date, t.end_date, tripNow.today),
        coverUrl: t.cover_image_path ? (coverUrls.get(t.cover_image_path) ?? null) : null,
        cities: [...t.trip_stops].sort((a, b) => a.position - b.position).map((s) => s.name),
        travelerCount: t.travelers[0]?.count ?? 0,
        progress: planningProgress({
          start: t.start_date,
          end: t.end_date,
          activities: t.activities,
          legs: t.transportations,
          stays: t.accommodations,
        }),
        today: tripNow.today,
        city: tripNow.stop?.name ?? null,
      };
    })
    .sort(compareTrips);

  // In progress: featured on top (usually one; several are shown the same way).
  const active: ActiveTripData[] = allTrips
    .filter((t) => t.status === "active")
    .map((t) => ({
      ...t,
      dayNumber: getTripDayNumber(t.start_date, t.end_date, t.today) ?? 1,
      days: getTripLengthDays(t.start_date, t.end_date) ?? 1,
    }));
  const sections = SECTIONS.map((s) => ({ ...s, trips: allTrips.filter((t) => t.status === s.status) }));
  const hasUpcoming = sections[0].trips.length > 0;
  const heading = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

  return (
    <main className="stagger mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {firstName && <p className="text-sm text-muted-foreground">Hola, {firstName}</p>}
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Mis viajes</h1>
        </div>
        <Button asChild size="lg" className="h-11 rounded-xl px-4">
          <Link href="/viajes/nuevo">
            <Plus aria-hidden="true" />
            Nuevo viaje
          </Link>
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar tus viajes. Recarga la página.
        </p>
      ) : allTrips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary" aria-hidden="true">
            <Plus className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">Aún no tienes viajes</p>
            <p className="text-sm text-muted-foreground">Empieza con un nombre; las fechas y lo demás pueden esperar.</p>
          </div>
          <Button asChild size="lg" className="h-11 px-5">
            <Link href="/viajes/nuevo">Crear mi primer viaje</Link>
          </Button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section aria-labelledby="trips-active" className="flex flex-col gap-2.5">
              <h2 id="trips-active" className={heading + " flex items-center gap-2"}>
                <span aria-hidden="true" className="size-2 animate-now-pulse rounded-full bg-success text-success" />
                En curso
              </h2>
              {active.map((trip) => (
                <ActiveTripCard key={trip.id} trip={trip} />
              ))}
            </section>
          )}

          {sections.map((section) =>
            section.trips.length > 0 ? (
              <section key={section.status} aria-labelledby={`trips-${section.status}`} className="flex flex-col gap-2.5">
                <h2 id={`trips-${section.status}`} className={heading}>
                  {section.label}
                </h2>
                <ul className="flex flex-col gap-3">
                  {section.trips.map((trip) => (
                    <li key={trip.id}>
                      <TripCard trip={trip} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : section.status === "upcoming" && !hasUpcoming ? (
              <Link
                key="next"
                href="/viajes/nuevo"
                className="pressable flex items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-primary/30 p-4 text-sm hover:bg-secondary/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary" aria-hidden="true">
                  <Plus className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold text-secondary-foreground">¿Cuál es el siguiente viaje?</span>
                  <span className="text-muted-foreground">Empieza con un nombre; lo demás puede esperar.</span>
                </span>
              </Link>
            ) : null,
          )}
        </>
      )}
    </main>
  );
}
