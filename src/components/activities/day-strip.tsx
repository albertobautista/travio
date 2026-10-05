"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type StripDay = {
  date: string;
  dayNumber: number | null;
  href: string;
  activityCount: number;
  active: boolean;
  today: boolean;
  /** Some activity that day overlaps another. */
  conflict: boolean;
};

const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

/**
 * The itinerary's day picker. Opens scrolled to the chosen day (today on the
 * road), instead of always at Día 1.
 */
export function DayStrip({ days }: { days: StripDay[] }) {
  const active = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // "nearest" on the page's own axis: only the strip scrolls, never the page.
    active.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
  }, []);

  return (
    <nav aria-label="Días del viaje" className="-mx-4 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none]">
      <ul className="flex w-max gap-2">
        {days.map((d) => {
          const date = new Date(`${d.date}T00:00:00Z`);
          const top = d.today ? "Hoy" : d.dayNumber ? `Día ${d.dayNumber}` : "Fuera";
          return (
            <li key={d.date}>
              <Link
                ref={d.active ? active : undefined}
                href={d.href}
                aria-current={d.active ? "date" : undefined}
                className={
                  "pressable relative flex size-[60px] flex-col items-center justify-center rounded-2xl border text-center transition-colors " +
                  (d.active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgba(31,94,219,.7)]"
                    : d.today
                      ? "border-primary/40 bg-secondary text-secondary-foreground"
                      : "bg-card hover:bg-muted")
                }
              >
                <span className={"text-[11px] " + (d.active ? "text-primary-foreground/85" : d.today ? "font-semibold" : "text-muted-foreground")}>
                  {top}
                </span>
                <span className="text-base leading-tight font-bold">{date.getUTCDate()}</span>
                <span className={"text-[11px] " + (d.active ? "text-primary-foreground/85" : "text-muted-foreground")}>
                  {weekday.format(date).replace(".", "")}
                  <span className="sr-only"> {month.format(date)}</span>
                </span>
                {d.conflict && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-warning" title="Hay choques de horario" />
                )}
                {d.activityCount > 0 && <span className="sr-only">, {d.activityCount} actividades</span>}
                {d.conflict && <span className="sr-only">, con choques de horario</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
