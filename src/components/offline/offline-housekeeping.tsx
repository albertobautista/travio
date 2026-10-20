"use client";

import { useEffect } from "react";

import { isOnline } from "@/lib/offline/connection";
import { clearOfflineData, forgetOtherTrips } from "@/lib/offline/storage";

/**
 * Keeps the offline copies in line with who's signed in:
 * - `tripIds` given (trips layout): drop copies of trips the user can no
 *   longer open (removed from it, or it was deleted).
 * - nothing given (login page): nobody is signed in, drop everything, so the
 *   next person to sign in on this device can't see the last one's trips.
 */
export function OfflineHousekeeping({ tripIds }: { tripIds?: string[] }) {
  const key = tripIds?.join(",");
  useEffect(() => {
    const ids = key === undefined ? null : key.split(",").filter(Boolean);
    isOnline()
      .then((online) => {
        if (!online) return; // offline, the list may just be a saved copy
        return ids ? forgetOtherTrips(ids) : clearOfflineData();
      })
      .catch((error) => console.error("Offline housekeeping failed", error));
  }, [key]);
  return null;
}
