import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const ACCOMMODATION_COLUMNS =
  "id, name, trip_stop_id, address, google_place_id, lat, lng, check_in_at, check_out_at, timezone, booking_ref, booking_url, booking_status, cost_amount, cost_currency, notes, accommodation_participants (traveler_id)";

/** A trip's stays in check-in order. Empty if the user can't see the trip. */
export const getAccommodations = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accommodations")
    .select(ACCOMMODATION_COLUMNS)
    .eq("trip_id", tripId)
    .order("check_in_at");
  if (error) console.error("getAccommodations failed", error);
  return data ?? [];
});

export const getAccommodation = cache(async (tripId: string, accommodationId: string) => {
  if (!isUuid(tripId) || !isUuid(accommodationId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("accommodations")
    .select(ACCOMMODATION_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", accommodationId)
    .maybeSingle();
  return data;
});

export type Accommodation = NonNullable<Awaited<ReturnType<typeof getAccommodation>>>;
