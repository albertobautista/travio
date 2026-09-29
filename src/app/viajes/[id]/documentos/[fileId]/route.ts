import type { NextRequest } from "next/server";

import { FILES_BUCKET } from "@/lib/files/rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/**
 * Seconds a signed URL stays valid. The browser follows the redirect right
 * away, so this only needs to cover that hop; a copied link dies quickly.
 */
const SIGNED_URL_SECONDS = 60;

/**
 * GET /viajes/{tripId}/documentos/{fileId}            -> opens the file (PDF viewer, image)
 * GET /viajes/{tripId}/documentos/{fileId}?descargar=1 -> downloads it with its original name
 *
 * Why a route instead of putting signed URLs in the page: links in the HTML
 * stay stable and secret-free, and a fresh URL is created only when someone
 * actually opens a file, after checking their access right then.
 *
 * Access is checked twice, both by the database with the user's session:
 *   1. Reading the files row needs the table's select policy (trip member).
 *   2. Signing the object needs the bucket's select policy (trip member).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/viajes/[id]/documentos/[fileId]">) {
  const { id: tripId, fileId } = await ctx.params;
  if (!isUuid(tripId) || !isUuid(fileId)) return new Response("No encontrado", { status: 404 });

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("files")
    .select("storage_path, original_name")
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .maybeSingle();
  // Missing and forbidden look the same, so nobody can probe which files exist.
  if (!file) return new Response("No encontrado", { status: 404 });

  const download = request.nextUrl.searchParams.get("descargar") === "1";
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    // `download` makes Storage send Content-Disposition: attachment with this name.
    .createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, download ? { download: file.original_name } : undefined);

  if (error || !data) {
    console.error("Signing file failed", file.storage_path, error);
    return new Response("No pudimos abrir el archivo", { status: 502 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      // The redirect contains a (short-lived) credential: never cache it.
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
