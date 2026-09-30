import { LogOut } from "lucide-react";

import { DesktopSidebar, GlobalNav } from "@/components/nav/app-nav";
import { createClient } from "@/lib/supabase/server";
import { formatTripDates, getTripStatus } from "@/lib/trips/dates";
import { resolveTripNow } from "@/lib/trips/today";

import { signOut } from "../login/actions";

/**
 * Shell for everything under /viajes: the navigation (bottom bar on phones,
 * sidebar on desktop) and the room it takes. Inside a trip, its own layout
 * shows the trip's navigation instead (GlobalNav hides itself there).
 */
export default async function TripsLayout({ children }: LayoutProps<"/viajes">) {
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date, trip_stops (timezone, arrives_on, departs_on)");

  // "Mapa" and "Guardados" go to the trip in progress, else the next one.
  const all = (trips ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    start: t.start_date,
    dates: t.start_date ? formatTripDates(t.start_date, t.end_date, { year: false }) : "",
    status: getTripStatus(t.start_date, t.end_date, resolveTripNow(t.trip_stops).today),
  }));
  const dated = all.filter((t) => t.start);
  const focus =
    dated.find((t) => t.status === "active") ??
    dated.filter((t) => t.status === "upcoming").sort((a, b) => a.start!.localeCompare(b.start!))[0] ??
    null;

  // Sidebar list: in progress, then upcoming (soonest first), undated, and past (latest first).
  const rank = { active: 0, upcoming: 1, undated: 2, past: 3 } as const;
  const sidebarTrips = [...all]
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.status === "past" ? (b.start ?? "").localeCompare(a.start ?? "") : (a.start ?? "").localeCompare(b.start ?? "")),
    )
    .map(({ id, name, dates }) => ({ id, name, dates }));

  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <LogOut className="size-[18px]" aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );

  return (
    <>
      <GlobalNav focusTripId={focus?.id ?? null} signOut={signOutButton} />
      <DesktopSidebar trips={sidebarTrips} focusTripId={focus?.id ?? null} footer={signOutButton} />
      {/* Room for the bottom bar (phones) or the sidebar (desktop). */}
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">{children}</div>
    </>
  );
}
