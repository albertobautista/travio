import { cache } from "react";

import { getAccommodations } from "@/lib/accommodations/queries";
import { getActivities } from "@/lib/activities/queries";
import { createClient } from "@/lib/supabase/server";
import { getTransportations } from "@/lib/transportations/queries";
import { isUuid } from "@/lib/uuid";

import { buildAttachTargets } from "./targets";

/**
 * A trip's documents, newest first, with the activity each one is attached to.
 * Only metadata: opening a file goes through /viajes/[id]/documentos/[fileId],
 * which creates a short-lived signed URL at click time.
 */
export const getTripFiles = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("id, original_name, mime_type, size_bytes, document_type, activity_id, accommodation_id, transportation_id, created_at, activities (id, title), accommodations (id, name), transportations (id, origin_name, destination_name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) console.error("getTripFiles failed", error);
  return data ?? [];
});

export type TripFile = Awaited<ReturnType<typeof getTripFiles>>[number];

/** Everything in the trip a document can be attached to (for the pickers). */
export const getAttachTargets = cache(async (tripId: string) => {
  const [activities, stays, legs] = await Promise.all([
    getActivities(tripId),
    getAccommodations(tripId),
    getTransportations(tripId),
  ]);
  return buildAttachTargets({ activities, stays, legs });
});
