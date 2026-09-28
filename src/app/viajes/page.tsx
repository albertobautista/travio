import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { TripCard, type TripCardData } from "@/components/trips/trip-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/initials";
import { getTripStatus, todayIn, type TripStatus } from "@/lib/trips/dates";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Mis viajes · Travio",
};

const FILTERS = [
  { key: "todos", label: "Todos", matches: () => true },
  { key: "proximos", label: "Próximos", matches: (s: TripStatus) => s === "upcoming" || s === "undated" },
  { key: "en-curso", label: "En curso", matches: (s: TripStatus) => s === "active" },
  { key: "pasados", label: "Pasados", matches: (s: TripStatus) => s === "past" },
] as const;

// Active trips first, then upcoming (soonest first), undated, and past (most recent first).
const STATUS_ORDER: Record<TripStatus, number> = { active: 0, upcoming: 1, undated: 2, past: 3 };

function compareTrips(a: TripCardData, b: TripCardData) {
  if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  const aStart = a.start_date ?? "";
  const bStart = b.start_date ?? "";
  return a.status === "past" ? bStart.localeCompare(aStart) : aStart.localeCompare(bStart);
}

export default async function TripsPage({ searchParams }: PageProps<"/viajes">) {
  const supabase = await createClient();

  // The proxy already redirects signed-out users; this is the real check.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) {
    redirect("/login?next=/viajes");
  }

  const { filtro } = await searchParams;
  const filter = FILTERS.find((f) => f.key === filtro) ?? FILTERS[0];

  // No filter by user needed: RLS only returns trips this user is a member of.
  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).single(),
    supabase.from("trips").select("id, name, start_date, end_date"),
  ]);

  const today = todayIn();
  const allTrips: TripCardData[] = (rows ?? [])
    .map((t) => ({ ...t, status: getTripStatus(t.start_date, t.end_date, today) }))
    .sort(compareTrips);
  const trips = allTrips.filter((t) => filter.matches(t.status));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar>
              {profile?.avatar_url && (
                // Google may refuse to serve profile photos when a Referer header is sent.
                <AvatarImage src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
              )}
              <AvatarFallback>{initials(profile?.display_name)}</AvatarFallback>
            </Avatar>
            <p className="truncate text-sm text-muted-foreground">
              Hola{profile?.display_name ? `, ${profile.display_name}` : ""}.
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Mis viajes</h1>
          <Button asChild size="icon-lg" className="size-11 rounded-xl">
            <Link href="/viajes/nuevo" aria-label="Nuevo viaje">
              <Plus className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <nav aria-label="Filtrar viajes" className="grid grid-cols-4 gap-1.5">
          {FILTERS.map((f) => {
            const active = f.key === filter.key;
            return (
              <Link
                key={f.key}
                href={f.key === "todos" ? "/viajes" : `/viajes?filtro=${f.key}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex h-9 items-center justify-center rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground"
                    : "flex h-9 items-center justify-center rounded-[10px] border bg-card text-[13px] font-medium text-foreground/80 hover:bg-muted"
                }
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {error ? (
        <p role="alert" className="text-destructive">
          No pudimos cargar tus viajes. Recarga la página.
        </p>
      ) : allTrips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-muted-foreground">Aún no tienes viajes.</p>
          <Button asChild size="lg">
            <Link href="/viajes/nuevo">Crear mi primer viaje</Link>
          </Button>
        </div>
      ) : trips.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
          No tienes viajes en “{filter.label}”.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={trip} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
