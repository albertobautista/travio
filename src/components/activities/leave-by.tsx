"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { formatDuration } from "@/lib/activities/schedule";
import { autoMode, TRAVEL_MODE_META, type Point, type TravelMode } from "@/lib/maps/travel";
import { formatClock, useTravelTime } from "@/lib/maps/use-travel-time";

type Props = {
  from: Point;
  to: Point;
  /** The activity's travel_mode (null = automatic). */
  mode: TravelMode | null;
  /** "Casa Bonay", "Sagrada Família"… */
  fromLabel: string;
  departAt: string;
  arriveAt: string;
  timeZone: string;
  /** Server time when the page was made; the clock then ticks here. */
  now: string;
};

/**
 * "Sal a las 10:05 · 25 min a pie desde Casa Bonay" on the next plan, and a
 * nudge once it's time to go. Leaving at that time gets you there on time,
 * with no margin: the timeline row says if the gap itself is too short.
 */
export function LeaveBy({ from, to, mode, fromLabel, departAt, arriveAt, timeZone, now: initialNow }: Props) {
  const effective = mode ?? autoMode(from, to);
  const time = useTravelTime(from, to, effective, departAt);
  const [now, setNow] = useState(() => Date.parse(initialNow));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const Icon = TRAVEL_MODE_META[effective].icon;
  if (!time) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Calculando cuándo salir…
      </p>
    );
  }
  const leave = Date.parse(arriveAt) - time.minutes * 60_000;
  const late = Math.round((now - leave) / 60_000);
  return (
    <div className="flex items-start gap-3 rounded-xl bg-secondary p-3 text-secondary-foreground">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <p className="font-semibold">
          {late > 0 ? "Sal ya" : late > -5 ? "Es hora de salir" : `Sal a las ${formatClock(new Date(leave), timeZone)}`}
          {late > 0 && <span className="font-normal"> · llegarías {formatDuration(late)} tarde</span>}
        </p>
        <p className="text-sm">
          {time.estimated ? "≈ " : ""}
          {formatDuration(time.minutes)} {TRAVEL_MODE_META[effective].short} desde {fromLabel}
          {time.estimated && <span title="Estimado en línea recta: no se pudo consultar la ruta."> (aprox.)</span>}
        </p>
      </div>
    </div>
  );
}
