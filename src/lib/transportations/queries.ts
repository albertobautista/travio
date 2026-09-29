import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

const TRANSPORTATION_COLUMNS =
  "id, type, origin_name, destination_name, departs_at, departs_timezone, arrives_at, arrives_timezone, carrier, service_number, booking_ref, booking_url, booking_status, departure_detail, arrival_detail, cost_amount, cost_currency, notes, transportation_participants (traveler_id, seat)";

/** A trip's transportation by departure. Empty if the user can't see the trip. */
export const getTransportations = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportations")
    .select(TRANSPORTATION_COLUMNS)
    .eq("trip_id", tripId)
    .order("departs_at");
  if (error) console.error("getTransportations failed", error);
  return data ?? [];
});

export const getTransportation = cache(async (tripId: string, transportationId: string) => {
  if (!isUuid(tripId) || !isUuid(transportationId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("transportations")
    .select(TRANSPORTATION_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", transportationId)
    .maybeSingle();
  return data;
});

export type Transportation = NonNullable<Awaited<ReturnType<typeof getTransportation>>>;
