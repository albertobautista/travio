import type { Metadata } from "next";
import { CloudOff } from "lucide-react";

import { SavedTrips } from "./saved-trips";

export const metadata: Metadata = {
  title: "Sin conexión · Travio",
  robots: { index: false, follow: false },
};

/**
 * What the service worker shows when there's no connection and the page asked
 * for isn't saved on the device. Stored when the worker installs, so it must
 * not depend on the session or the database: it's the same for everyone, and
 * the list of saved trips is read in the browser.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
          <CloudOff className="size-6" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Sin conexión</h1>
        <p className="text-sm text-muted-foreground">
          Esta página no está guardada en el teléfono. Abre un viaje guardado o vuelve a intentarlo cuando tengas conexión.
        </p>
      </div>
      <SavedTrips />
    </main>
  );
}
