"use client";

import { useEffect, useState } from "react";
import { ChevronRight, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { savedTripPages } from "@/lib/offline/storage";

type Saved = Awaited<ReturnType<typeof savedTripPages>>;

/** Trips with pages kept on this device. Plain <a>: a full load, answered by the service worker. */
export function SavedTrips() {
  const [trips, setTrips] = useState<Saved | null>(null);

  useEffect(() => {
    savedTripPages()
      .then(setTrips)
      .catch(() => setTrips([]));
  }, []);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {trips && trips.length > 0 && (
        <section aria-labelledby="saved-trips" className="flex flex-col gap-2">
          <h2 id="saved-trips" className="text-sm font-medium text-muted-foreground">
            Guardados en este teléfono
          </h2>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {trips.map((trip) => (
              <li key={trip.tripId}>
                <a href={trip.path} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted">
                  <span className="flex-1 font-medium">{trip.title ?? "Viaje"}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button size="lg" variant={trips && trips.length > 0 ? "outline" : "default"} onClick={() => location.reload()}>
        <RotateCw aria-hidden="true" />
        Reintentar
      </Button>
    </div>
  );
}
