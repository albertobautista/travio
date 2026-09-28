import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type TripRole = "owner" | "editor" | "viewer";

/** trip_members.role is `text` with a check constraint, so it's typed as string. */
export function toTripRole(value: string | null | undefined): TripRole | null {
  return value === "owner" || value === "editor" || value === "viewer" ? value : null;
}

/**
 * One trip, or null if it doesn't exist or the user isn't a member (RLS makes
 * both cases look the same). `cache` dedupes calls within one request, e.g.
 * generateMetadata and the page.
 */
export const getTrip = cache(async (id: string) => {
  // A malformed id would make Postgres throw; treat it like any unknown trip.
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("id, name, description, start_date, end_date, currency")
    .eq("id", id)
    .maybeSingle();
  return data;
});

/** The signed-in user's role in a trip, from the same function RLS uses. */
export const getMyTripRole = cache(async (tripId: string): Promise<TripRole | null> => {
  if (!isUuid(tripId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("trip_role", { p_trip_id: tripId });
  return toTripRole(data);
});

/** Mirrors the database rules; only for deciding what to show. RLS still decides. */
export const canEdit = (role: TripRole | null) => role === "owner" || role === "editor";
export const canDelete = (role: TripRole | null) => role === "owner";
