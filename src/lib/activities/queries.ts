import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const ACTIVITY_COLUMNS =
  "id, title, category, trip_stop_id, starts_at, duration_minutes, timezone, location_name, address, google_place_id, lat, lng, booking_status, travel_mode, reservation_ref, cost_amount, cost_currency, external_url, notes, activity_participants (traveler_id)";

/** All of a trip's activities by start time. Empty if the user can't see the trip. */
export const getActivities = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .eq("trip_id", tripId)
    .order("starts_at");
  return data ?? [];
});

export const getActivity = cache(async (tripId: string, activityId: string) => {
  if (!isUuid(tripId) || !isUuid(activityId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", activityId)
    .maybeSingle();
  return data;
});

export type Activity = NonNullable<Awaited<ReturnType<typeof getActivity>>>;
