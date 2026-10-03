import { DesktopSidebar, GlobalNav, type SidebarTrip } from "@/components/nav/app-nav";
import { OfflineHousekeeping } from "@/components/offline/offline-housekeeping";
import { SignOutButton } from "@/components/offline/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { getCoverUrls } from "@/lib/trips/cover-urls";
import { formatTripDates, getTripDayNumber, getTripStatus } from "@/lib/trips/dates";
import { resolveTripNow } from "@/lib/trips/today";

/**
 * Shell for everything under /viajes: the navigation (bottom bar on phones,
 * sidebar on desktop) and the room it takes. Inside a trip, its own layout
 * adds the trip's navigation (tabs on desktop, its bottom bar on phones).
 */
export default async function TripsLayout({ children }: LayoutProps<"/viajes">) {
  const supabase = await createClient();
  const [{ data: trips }, { data: claims }] = await Promise.all([
    supabase.from("trips").select("id, name, start_date, end_date, cover_image_path, trip_stops (timezone, arrives_on, departs_on)"),
    supabase.auth.getClaims(),
  ]);
  const userId = claims?.claims.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()
    : { data: null };
  const covers = await getCoverUrls((trips ?? []).map((t) => t.cover_image_path));

  const all: SidebarTrip[] = (trips ?? []).map((t) => {
    const today = resolveTripNow(t.trip_stops).today;
    return {
      id: t.id,
      name: t.name,
      start: t.start_date,
      dates: t.start_date ? formatTripDates(t.start_date, t.end_date, { year: false }) : "Sin fechas",
      status: getTripStatus(t.start_date, t.end_date, today),
      dayNumber: getTripDayNumber(t.start_date, t.end_date, today),
      coverUrl: t.cover_image_path ? (covers.get(t.cover_image_path) ?? null) : null,
    };
  });
  // Sidebar order: in progress, upcoming (soonest first), undated, past (latest first).
  const rank = { active: 0, upcoming: 1, undated: 2, past: 3 } as const;
  const sidebarTrips = [...all].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "past" ? (b.start ?? "").localeCompare(a.start ?? "") : (a.start ?? "").localeCompare(b.start ?? "")),
  );
  // "Hoy" shortcuts only for a trip actually in progress: no implicit trip.
  const active = sidebarTrips.find((t) => t.status === "active") ?? null;
  const name = profile?.display_name || (claims?.claims.email as string | undefined) || "Tu cuenta";

  const signOutButton = <SignOutButton />;

  return (
    <>
      <OfflineHousekeeping tripIds={all.map((t) => t.id)} />
      <GlobalNav activeTrip={active ? { id: active.id, name: active.name } : null} signOut={signOutButton} />
      <DesktopSidebar trips={sidebarTrips} active={active} account={{ name }} signOut={signOutButton} />
      {/* Room for the bottom bar (phones) or the sidebar (desktop). */}
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">{children}</div>
    </>
  );
}
