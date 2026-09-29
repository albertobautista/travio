import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const SAVED_PLACE_COLUMNS =
  "id, trip_stop_id, name, category, google_place_id, address, lat, lng, estimated_minutes, external_url, notes, created_at, activities (id, starts_at, timezone)";

/** A trip's saved places, newest first, with the activities planned from each. */
export const getSavedPlaces = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .select(SAVED_PLACE_COLUMNS)
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) console.error("getSavedPlaces failed", error);
  return data ?? [];
});

export const getSavedPlace = cache(async (tripId: string, placeId: string) => {
  if (!isUuid(tripId) || !isUuid(placeId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_places")
    .select(SAVED_PLACE_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", placeId)
    .maybeSingle();
  return data;
});

export type SavedPlace = NonNullable<Awaited<ReturnType<typeof getSavedPlace>>>;
