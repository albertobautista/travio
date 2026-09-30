"use client";

import { useEffect, useState } from "react";

import { getTravelTime, type TravelTime } from "./routes";
import type { Point, TravelMode } from "./travel";

/**
 * The travel time for a trip, once `enabled` (e.g. when it's on screen).
 * Components asking for the same trip share one request (see getTravelTime).
 */
export function useTravelTime(from: Point, to: Point, mode: TravelMode, departAt: string, enabled = true): TravelTime | null {
  // Primitive key, so new objects with the same values don't refetch.
  const key = `${mode}|${from.lat},${from.lng}|${to.lat},${to.lng}|${departAt}`;
  const [result, setResult] = useState<{ key: string; time: TravelTime } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const [m, a, b, when] = key.split("|");
    const [fromLat, fromLng] = a.split(",").map(Number);
    const [toLat, toLng] = b.split(",").map(Number);
    getTravelTime({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }, m as TravelMode, new Date(when)).then((time) => {
      if (!cancelled) setResult({ key, time });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);

  // A result for other inputs (the mode just changed) isn't shown.
  return result?.key === key ? result.time : null;
}

/** "10:05" in the activity's time zone. */
export function formatClock(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date);
}
