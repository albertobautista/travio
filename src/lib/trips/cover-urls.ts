import "server-only";

import { createClient } from "@/lib/supabase/server";

import { COVERS_BUCKET } from "./covers";

/** Long enough to browse a page, short enough that a leaked link stops working soon. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Temporary URLs for cover images, keyed by storage path.
 *
 * Signing runs with the user's session, so Storage checks the bucket's select
 * policy: only members of the trip get a URL. Paths that fail (missing file,
 * no access) are left out, and the UI falls back to the placeholder.
 */
export async function getCoverUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(COVERS_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) {
    console.error("getCoverUrls failed", error);
    return urls;
  }

  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
