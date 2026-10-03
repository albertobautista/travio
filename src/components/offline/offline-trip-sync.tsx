"use client";

import { useEffect } from "react";

import { savePage, SYNC_KEY_PREFIX } from "@/lib/offline/storage";

/** Save the trip again at most this often, so moving between tabs doesn't refetch everything. */
const RESYNC_MS = 15 * 60_000;

/**
 * For the trip in progress (or starting tomorrow): quietly saves its main
 * pages on the device, so they open without connection even if the user
 * never visited them. Pages opened normally are saved by the service worker
 * anyway; this fills in the rest (other days, tickets…).
 *
 * Only runs once the service worker controls the page: without it nothing
 * would serve these copies.
 */
export function OfflineTripSync({ tripId, paths }: { tripId: string; paths: string[] }) {
  const key = paths.join("\n");
  useEffect(() => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker || !navigator.onLine) return;
    const syncKey = SYNC_KEY_PREFIX + tripId;
    try {
      const last = Number(localStorage.getItem(syncKey));
      if (last && Date.now() - last < RESYNC_MS) return;
    } catch {
      // No localStorage: sync every time, it's only a few requests.
    }

    let cancelled = false;
    const run = async () => {
      // One at a time: it's background work, the page in front matters more.
      for (const path of key.split("\n")) {
        if (cancelled || !navigator.onLine) return;
        try {
          const html = await savePage(path);
          // Let the worker store the page's CSS/JS too, so the copy looks right.
          if (html) worker.postMessage({ type: "cache-assets", html });
        } catch {
          // A page that fails now will be saved on the next run.
        }
      }
      try {
        localStorage.setItem(syncKey, String(Date.now()));
      } catch {}
    };
    // Wait until the browser is idle, so it never slows down the page.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    const handle = idle(() => void run());
    return () => {
      cancelled = true;
      (window.cancelIdleCallback ?? window.clearTimeout)(handle);
    };
  }, [tripId, key]);
  return null;
}
