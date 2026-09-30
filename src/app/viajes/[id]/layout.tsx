import Link from "next/link";
import { Pencil, Plus } from "lucide-react";

import { TripNav, TripTabs } from "@/components/nav/app-nav";
import { RailSlot } from "@/components/trips/rail-slot";
import { TripRail } from "@/components/trips/trip-rail";
import { Button } from "@/components/ui/button";
import { getTravelers } from "@/lib/travelers/queries";
import { formatTripDates, getTripLengthDays } from "@/lib/trips/dates";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";

/**
 * Every trip page gets the trip's navigation: the bottom bar on phones; on
 * desktop a header with the trip's tabs, and a side panel on wide screens.
 * Pages still 404 on their own for unknown trips.
 */
export default async function TripLayout({ children, params }: LayoutProps<"/viajes/[id]">) {
  const { id } = await params;
  const [trip, role, stops, travelers] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getTravelers(id)]);
  if (!trip) return children;

  const editable = canEdit(role);
  const base = `/viajes/${trip.id}`;
  const days = getTripLengthDays(trip.start_date, trip.end_date);
  const facts = [
    formatTripDates(trip.start_date, trip.end_date),
    days ? (days === 1 ? "1 día" : `${days} días`) : null,
    stops.length ? (stops.length === 1 ? "1 ciudad" : `${stops.length} ciudades`) : null,
    travelers.length ? (travelers.length === 1 ? "1 viajero" : `${travelers.length} viajeros`) : null,
  ].filter(Boolean);

  return (
    <>
      <TripNav tripId={trip.id} tripName={trip.name} editable={editable} />
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="hidden border-b bg-card px-6 pt-5 lg:block">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {/* Not a heading: each page has its own h1. */}
                <p className="truncate text-xl font-bold tracking-tight">{trip.name}</p>
                <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
              </div>
              {editable && (
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline" className="h-10">
                    <Link href={`${base}/editar`}>
                      <Pencil aria-hidden="true" />
                      Editar
                    </Link>
                  </Button>
                  <Button asChild className="h-10">
                    <Link href={`${base}/actividades/nueva`}>
                      <Plus aria-hidden="true" />
                      Añadir actividad
                    </Link>
                  </Button>
                </div>
              )}
            </div>
            <TripTabs tripId={trip.id} editable={editable} />
          </div>
          {children}
        </div>
        <RailSlot tripId={trip.id}>
          <TripRail tripId={trip.id} />
        </RailSlot>
      </div>
    </>
  );
}
