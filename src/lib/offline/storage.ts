/**
 * What the app keeps on the device for offline use, from the browser side.
 * The service worker (public/sw.js) serves these copies when there's no
 * connection; this module saves, reads and deletes them. Cache names and the
 * saved-at header must match sw.js.
 *
 * Everything here holds the signed-in user's private data, so it's deleted on
 * sign out and whenever the login page shows (another person may sign in on
 * this device next).
 */

export const PAGES_CACHE = "travio-pages";
export const IMAGES_CACHE = "travio-images";
export const DOCUMENTS_CACHE = "travio-documents";
const PRIVATE_CACHES = [PAGES_CACHE, IMAGES_CACHE, DOCUMENTS_CACHE];
const SAVED_AT = "x-travio-saved-at";
/** localStorage key prefix: when each trip was last saved (see offline-trip-sync.tsx). */
export const SYNC_KEY_PREFIX = "travio-offline-sync:";

const TRIP_IN_URL = /^\/viajes\/([0-9a-f-]{36})(\/|$)/i;

function hasCaches() {
  return typeof window !== "undefined" && "caches" in window;
}

/** Sign out / login page: remove every private copy from this device. */
export async function clearOfflineData() {
  if (!hasCaches()) return;
  await Promise.all(PRIVATE_CACHES.map((name) => caches.delete(name)));
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(SYNC_KEY_PREFIX)) localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing was saved there either.
  }
}

/**
 * Remove copies of trips the user no longer has access to (removed from the
 * trip, trip deleted). Called with the trips the server just listed.
 */
export async function forgetOtherTrips(tripIds: string[]) {
  if (!hasCaches()) return;
  const keep = new Set(tripIds);
  for (const name of [PAGES_CACHE, DOCUMENTS_CACHE]) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const trip = new URL(request.url).pathname.match(TRIP_IN_URL)?.[1];
      if (trip && !keep.has(trip)) await cache.delete(request);
    }
  }
}

/**
 * Fetch a page and store it like the service worker does when you open it.
 * Returns the HTML so the caller can have its CSS/JS stored too, or null if
 * the page didn't come back (signed out, no access, offline).
 */
export async function savePage(path: string): Promise<string | null> {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok || response.redirected) return null;
  const html = await response.text();
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(
    new URL(path, location.origin).href,
    new Response(html, {
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "text/html; charset=utf-8", [SAVED_AT]: new Date().toISOString() },
    }),
  );
  return html;
}

/** When the stored copy of this page was saved, if there is one. */
export async function pageSavedAt(href: string): Promise<Date | null> {
  if (!hasCaches()) return null;
  const saved = await caches.match(href, { cacheName: PAGES_CACHE, ignoreVary: true });
  const at = saved?.headers.get(SAVED_AT);
  return at ? new Date(at) : null;
}

/** Trip ids with at least one page saved on this device (for the offline page). */
export async function savedTripPages(): Promise<{ tripId: string; path: string; title: string | null }[]> {
  if (!hasCaches()) return [];
  const cache = await caches.open(PAGES_CACHE);
  const byTrip = new Map<string, { tripId: string; path: string; title: string | null }>();
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    const trip = pathname.match(TRIP_IN_URL)?.[1];
    // Hoy is the page to open offline; fall back to any page of the trip.
    if (!trip || (byTrip.has(trip) && !pathname.endsWith("/hoy"))) continue;
    const html = await (await cache.match(request))?.text();
    // Page titles look like "Hoy · España 2026 · Travio".
    const parts = html?.match(/<title>([^<]*)<\/title>/)?.[1].split(" · ") ?? [];
    byTrip.set(trip, { tripId: trip, path: pathname, title: parts.length >= 3 ? parts[parts.length - 2] : null });
  }
  return [...byTrip.values()];
}

// ---------------------------------------------------------------------------
// Documents ("Descargar para el viaje")
// ---------------------------------------------------------------------------

/** The same URL the app links to; the service worker answers it from the device. */
export function documentUrl(tripId: string, fileId: string) {
  return new URL(`/viajes/${tripId}/documentos/${fileId}`, location.origin).href;
}

/** Which of these files are already on the device. */
export async function savedDocumentIds(tripId: string, fileIds: string[]) {
  if (!hasCaches()) return new Set<string>();
  const cache = await caches.open(DOCUMENTS_CACHE);
  const saved = await Promise.all(fileIds.map(async (id) => ((await cache.match(documentUrl(tripId, id))) ? id : null)));
  return new Set(saved.filter((id): id is string => id !== null));
}

/**
 * Download one file and keep it. The request goes through the normal access
 * check (documentos/[fileId] redirects to a short-lived signed URL), so only
 * files the user may open can be saved.
 *
 * The body is copied into a new Response: a stored redirected response can't
 * be used to answer a page load or an iframe.
 */
export async function saveDocument(tripId: string, file: { id: string; name: string }) {
  const url = documentUrl(tripId, file.id);
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  const cache = await caches.open(DOCUMENTS_CACHE);
  await cache.put(
    url,
    new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Content-Length": String(blob.size),
        "x-travio-filename": encodeURIComponent(file.name),
        [SAVED_AT]: new Date().toISOString(),
      },
    }),
  );
}

export async function removeDocuments(tripId: string, fileIds: string[]) {
  if (!hasCaches()) return;
  const cache = await caches.open(DOCUMENTS_CACHE);
  await Promise.all(fileIds.map((id) => cache.delete(documentUrl(tripId, id))));
}
