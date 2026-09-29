"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { clockParts } from "@/lib/trips/clock";

/**
 * The clock the "Hoy" screen uses: local time where the travelers are.
 * Activities, "ahora" and "en 25 min" are all computed against it.
 *
 * The first render uses the server's text so server and browser HTML match.
 * After that the browser's clock takes over, and if the device is in another
 * time zone (planning from home) we also show the device's time.
 */
export function TripClock({
  timeZone,
  place,
  initial,
}: {
  timeZone: string;
  place: string;
  initial: { time: string; offset: string };
}) {
  const [time, setTime] = useState(initial.time);
  const [offset, setOffset] = useState(initial.offset);
  const [deviceTime, setDeviceTime] = useState<string | null>(null);

  useEffect(() => {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const update = () => {
      const now = new Date();
      const trip = clockParts(now, timeZone);
      setTime(trip.time);
      setOffset(trip.offset);
      const device = clockParts(now, deviceZone);
      setDeviceTime(device.offset !== trip.offset ? device.time : null);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [timeZone]);

  return (
    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <Clock className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
      <span className="flex flex-col">
        <span>
          Son las <time className="font-mono font-semibold text-foreground">{time}</time> en {place}
          {offset && ` (${offset})`}
        </span>
        {deviceTime && (
          <span className="text-xs">
            En tu dispositivo son las <span className="font-mono">{deviceTime}</span>
          </span>
        )}
      </span>
    </p>
  );
}
