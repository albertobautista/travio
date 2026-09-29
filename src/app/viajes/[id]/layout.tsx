import { TripNav } from "@/components/nav/app-nav";
import { canEdit, getMyTripRole, getTrip } from "@/lib/trips/queries";

/** Every trip page gets the trip's navigation. Pages still 404 on their own for unknown trips. */
export default async function TripLayout({ children, params }: LayoutProps<"/viajes/[id]">) {
  const { id } = await params;
  const [trip, role] = await Promise.all([getTrip(id), getMyTripRole(id)]);
  return (
    <>
      {trip && <TripNav tripId={trip.id} tripName={trip.name} editable={canEdit(role)} />}
      {children}
    </>
  );
}
