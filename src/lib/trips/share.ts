import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Share links (/v/<code>): a trip's link preview for anyone, access for
// nobody. What the preview may show is decided in the database
// (trip_preview in 20261022120000_trip_share_links.sql).

/** new_share_code makes 16 random bytes, base64url without padding. */
const SHARE_CODE = /^[A-Za-z0-9_-]{22}$/;

export function isShareCode(value: string) {
  return SHARE_CODE.test(value);
}

/** What a link preview shows. Mirrors trip_preview's jsonb. */
export type TripPreview = {
  trip_id: string;
  trip_name: string;
  start_date: string | null;
  end_date: string | null;
  /** Stop names in route order (at most 12). */
  cities: string[];
  has_cover: boolean;
  /** Changes whenever the picture would: part of the image URL, so chat apps don't keep an old one. */
  version: string;
};

export type SharePreview = TripPreview & {
  /** member: the caller is in the trip, so /v/<code> sends them there. */
  status: "member" | "preview";
};

/** The trip behind a share code, or null. Works signed out (chat apps fetch previews with no session). */
export const getSharePreview = cache(async (code: string): Promise<SharePreview | null> => {
  if (!isShareCode(code)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_trip_share_preview", { p_code: code });
  if (error) {
    console.error("get_trip_share_preview failed", error);
    return null;
  }
  return (data as SharePreview | null) ?? null;
});
