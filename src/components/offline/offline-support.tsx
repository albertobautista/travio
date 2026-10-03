"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";

import { pageSavedAt } from "@/lib/offline/storage";

const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Mounted once in the root layout:
 * 1. Registers the service worker (public/sw.js). Production only: in
 *    development it would keep serving old copies of files that change on
 *    every save. NEXT_PUBLIC_ENABLE_SW=1 turns it on to try it locally.
 * 2. While offline, shows a banner with when the page's data was saved.
 * 3. While offline, turns link clicks into full page loads. In-app navigation
 *    fetches fresh data from the server, which fails without connection; a
 *    full load goes through the service worker, which has the saved copy.
 */
export function OfflineSupport() {
  const router = useRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
    if (enabled && "serviceWorker" in navigator) {
      // updateViaCache "none": always check for a new sw.js, never a cached one.
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
        console.error("Service worker registration failed", error);
      });
    }
  }, []);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    const backOnline = () => {
      sync();
      router.refresh(); // replace what came from the saved copy with fresh data
    };
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", backOnline);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", backOnline);
    };
  }, [router]);

  useEffect(() => {
    if (!offline) return;
    let cancelled = false;
    pageSavedAt(location.href).then((at) => {
      if (!cancelled) setSavedAt(at);
    });

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      event.preventDefault();
      event.stopPropagation(); // before Next's Link handles it
      location.assign(url.href);
    };
    // Capture phase on document: runs before React's own listeners.
    document.addEventListener("click", onClick, true);
    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick, true);
    };
  }, [offline, pathname]);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-center text-sm text-warning-foreground"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">Sin conexión.</span>{" "}
        {savedAt ? `Datos guardados a las ${timeFormat.format(savedAt)}.` : "Ves lo último que cargaste."} No se pueden hacer cambios.
      </span>
    </div>
  );
}
