"use client";

import { useEffect, useState } from "react";

import { formatDuration } from "@/lib/activities/schedule";

function progress(start: number, end: number, now: number) {
  const left = Math.max(0, Math.ceil((end - now) / 60_000));
  const share = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return { left, share };
}

/**
 * For the activity happening now: "Termina en 12 min" and a bar with how much
 * of it has gone by. Ticks every 30 s; the first render uses the server's
 * time so server and browser HTML match.
 */
export function EndsIn({ startsAt, endsAt, now: initialNow }: { startsAt: string; endsAt: string; now: string }) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const [now, setNow] = useState(() => Date.parse(initialNow));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { left, share } = progress(start, end, now);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-right text-sm text-muted-foreground">
        {left === 0 ? "Termina ahora" : <>Termina en <strong className="font-semibold text-foreground">{formatDuration(left)}</strong></>}
      </p>
      <div
        role="progressbar"
        aria-label="Tiempo transcurrido"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-border"
      >
        <div className="bar-fill h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
