import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

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
    .select("id, original_name, mime_type, size_bytes, document_type, activity_id, accommodation_id, created_at, activities (id, title), accommodations (id, name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) console.error("getTripFiles failed", error);
  return data ?? [];
});

export type TripFile = Awaited<ReturnType<typeof getTripFiles>>[number];
