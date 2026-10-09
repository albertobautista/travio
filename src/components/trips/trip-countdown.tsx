"use client";

import { useEffect, useState } from "react";
import { Hourglass, Plane } from "lucide-react";

import { timeLeft, type CountdownTarget } from "@/lib/trips/countdown";

/**
 * Days, hours and minutes until the trip (its first departure, or its first
 * day). Starts from the server's clock so the first paint matches, then ticks
 * every minute in the browser.
 */
export function TripCountdown({ target, serverNow }: { target: CountdownTarget; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    // Wake up right after each minute changes, then every minute.
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);
    return () => {
      clearTimeout(align);
      clearInterval(interval);
    };
  }, []);

  const left = timeLeft(target.at, now);
  const Icon = target.detail ? Plane : Hourglass;
  const units = [
    { value: left.days, label: left.days === 1 ? "día" : "días" },
    { value: left.hours, label: left.hours === 1 ? "hora" : "horas" },
    { value: left.minutes, label: "min" },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Icon className="size-3.5" aria-hidden="true" />
        {left.done ? "¡Llegó la hora!" : target.title}
      </p>
      {!left.done && (
        <div className="grid grid-cols-3 gap-2 text-center" role="timer" aria-live="off">
          {units.map((u) => (
            <span key={u.label} className="flex flex-col rounded-xl bg-muted py-2">
              <span className="font-mono text-2xl leading-tight font-semibold tabular-nums">{u.value}</span>
              <span className="text-[11px] text-muted-foreground">{u.label}</span>
            </span>
          ))}
        </div>
      )}
      {target.detail && <p className="truncate text-xs text-muted-foreground">{target.detail}</p>}
    </div>
  );
}
