import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type Traveler = {
  id: string;
  name: string;
  color: string;
  user_id: string | null;
  /** Photo of the linked account, if any. */
  avatar_url: string | null;
};

/** A trip's travelers in the order they were added. */
export const getTravelers = cache(async (tripId: string): Promise<Traveler[]> => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("travelers")
    // travelers has two foreign keys to profiles (user_id, created_by), so the
    // embed names which one to follow.
    .select("id, name, color, user_id, profile:profiles!travelers_user_id_fkey (avatar_url)")
    .eq("trip_id", tripId)
    .order("created_at");
  return (data ?? []).map(({ profile, ...t }) => ({ ...t, avatar_url: profile?.avatar_url ?? null }));
});
