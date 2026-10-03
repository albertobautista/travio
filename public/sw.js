/*
 * Travio's service worker. The browser installs it next to the app and sends
 * it every request the app makes; it decides whether to answer from the
 * network or from copies kept on the device (Cache Storage).
 *
 * Plain JavaScript on purpose: it isn't bundled, so what's here is exactly
 * what runs. Registered in production only (src/components/offline/offline-support.tsx).
 *
 * What it keeps, and for how long:
 *   travio-shell-*   The "Sin conexión" page and icons. Stored at install.
 *   travio-static    /_next/static files. Their names change with every
 *                    build, so a stored copy is never outdated.
 *   travio-pages     Trip pages (HTML) the user opened or that were saved for
 *                    the trip in progress. Always fetched fresh when online;
 *                    the copy is only for when the network fails.
 *   travio-images    Trip covers (signed URLs). Capped.
 *   travio-documents Tickets and bookings the user chose to keep on the
 *                    device ("Descargar para el viaje").
 *
 * The last three hold the user's private data: the app deletes them on sign
 * out and whenever the login page shows (src/lib/offline/storage.ts).
 */

const VERSION = "v1";
const SHELL = `travio-shell-${VERSION}`;
const STATIC = "travio-static";
const PAGES = "travio-pages";
const IMAGES = "travio-images";
const DOCUMENTS = "travio-documents";
const KNOWN = [SHELL, STATIC, PAGES, IMAGES, DOCUMENTS];

const OFFLINE_URL = "/sin-conexion";
const SHELL_FILES = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];
// On a weak connection, wait this long for the network before showing the saved copy.
const NETWORK_TIMEOUT_MS = 5000;
const MAX_IMAGES = 60;
// Header the app and this worker add to stored copies, to show "datos de las 18:40".
const SAVED_AT = "x-travio-saved-at";

const DOCUMENT_PATH = /^\/viajes\/[0-9a-f-]{36}\/documentos\/[0-9a-f-]{36}$/i;
const COVER_PATH = /^\/storage\/v1\/object\/sign\/trip-covers\//;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(SHELL_FILES);
      // The offline page needs its CSS and JS too.
      const html = await (await cache.match(OFFLINE_URL)).text();
      await cacheStaticAssets(html);
      // Take over right away instead of waiting for every tab to close.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from older versions of this file.
      for (const name of await caches.keys()) {
        if (name.startsWith("travio-") && !KNOWN.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // Server Actions, uploads: always the network.
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (COVER_PATH.test(url.pathname)) event.respondWith(cacheFirst(IMAGES, request, MAX_IMAGES));
    return; // Google Maps, weather…: the browser handles them as usual.
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(STATIC, request));
    return;
  }
  if (DOCUMENT_PATH.test(url.pathname)) {
    event.respondWith(documentResponse(request, url));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(pageResponse(request, url));
  }
  // Anything else (RSC payloads for in-app navigation, API calls) goes to the
  // network untouched. When offline, the app turns link clicks into full page
  // loads so they come through pageResponse (offline-support.tsx).
});

/** Hashed files: a stored copy is always right, so use it and skip the network. */
async function cacheFirst(cacheName, request, max) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  // Opaque responses (cross-origin images) report status 0 but are fine to keep.
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (max) await trim(cache, max);
  }
  return response;
}

/**
 * A full page load. Network first, so data is never older than it must be;
 * the stored copy covers no connection (or a very slow one).
 */
async function pageResponse(request, url) {
  const keep = url.pathname === "/viajes" || url.pathname.startsWith("/viajes/");
  const network = fetch(request).then(async (response) => {
    // Only real trip pages: not redirects (e.g. to /login when signed out) nor errors.
    if (keep && response.ok && !response.redirected) {
      const cache = await caches.open(PAGES);
      await cache.put(url.href, await withSavedAt(response.clone()));
    }
    return response;
  });
  network.catch(() => {}); // handled below; avoids an "unhandled rejection" when the copy won the race

  const saved = keep ? await caches.match(url.href, { cacheName: PAGES, ignoreVary: true }) : undefined;
  try {
    if (!saved) return await network;
    // Use the network if it answers in time; otherwise the copy (the network
    // request keeps going and refreshes the copy for next time).
    return await Promise.race([network, delay(NETWORK_TIMEOUT_MS).then(() => saved)]);
  } catch {
    return saved ?? (await caches.match(OFFLINE_URL, { cacheName: SHELL })) ?? Response.error();
  }
}

/**
 * /viajes/{trip}/documentos/{file}: a file saved on the device wins (files
 * never change once uploaded, and it saves data); else the network, which
 * redirects to a signed URL.
 */
async function documentResponse(request, url) {
  const saved = await caches.match(url.origin + url.pathname, { cacheName: DOCUMENTS });
  if (saved) {
    if (url.searchParams.get("descargar") !== "1") return saved;
    // "Descargar": same file, with its original name.
    const headers = new Headers(saved.headers);
    const name = decodeURIComponent(saved.headers.get("x-travio-filename") ?? "documento");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    return new Response(saved.body, { headers });
  }
  try {
    return await fetch(request);
  } catch {
    return notSaved(request);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A file that isn't on the device, opened without connection (ticket preview, new tab). */
function notSaved(request) {
  if (request.destination === "image") return Response.error();
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<body style="font-family:system-ui,sans-serif;color:#33455E;padding:24px;line-height:1.5">
<p><strong>Este archivo no está guardado en el teléfono.</strong></p>
<p>Cuando tengas conexión, ve a Documentos y toca «Descargar para el viaje».</p></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * A copy to store: same body and type, plus when it was saved. Other headers
 * are dropped on purpose, Vary in particular (Next.js varies on headers that
 * a plain page load doesn't send, which would make the copy never match).
 */
async function withSavedAt(response) {
  return new Response(await response.blob(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "text/html; charset=utf-8",
      [SAVED_AT]: new Date().toISOString(),
    },
  });
}

/** Store the CSS, JS and fonts a page's HTML refers to, so the copy renders offline. */
async function cacheStaticAssets(html) {
  const urls = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];
  const cache = await caches.open(STATIC);
  await Promise.all(
    urls.map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const response = await fetch(u);
        if (response.ok) await cache.put(u, response);
      } catch {
        // Not fatal: the page still shows its server-rendered HTML.
      }
    }),
  );
}

/** Keep at most `max` entries, dropping the oldest (keys come back in insertion order). */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The app asks the worker to store a page's assets after saving a page itself.
self.addEventListener("message", (event) => {
  if (event.data?.type === "cache-assets" && typeof event.data.html === "string") {
    event.waitUntil(cacheStaticAssets(event.data.html));
  }
});
