import { Umbrella } from "lucide-react";

import { WEATHER_ATTRIBUTION, weatherMeta, type DayWeather, type NowWeather } from "@/lib/weather/types";

type Props = {
  city: string;
  now: NowWeather;
  today: DayWeather | null;
  /** Today's plans, "HH:MM" local, to point out which ones the rain hits. */
  plans: { title: string; time: string }[];
};

/** Group consecutive rainy hours: ["16:00","17:00","18:00"] -> "16:00–19:00". */
function rainWindows(hours: { time: string; chance: number }[]) {
  const windows: { from: string; to: string; peak: number }[] = [];
  for (const h of hours) {
    const hour = Number(h.time.slice(0, 2));
    const last = windows.at(-1);
    if (last && Number(last.to.slice(0, 2)) === hour) {
      last.to = `${String(hour + 1).padStart(2, "0")}:00`;
      last.peak = Math.max(last.peak, h.chance);
    } else {
      windows.push({ from: h.time, to: `${String(hour + 1).padStart(2, "0")}:00`, peak: h.chance });
    }
  }
  return windows;
}

/** Weather for "Hoy": now, today's range, and whether rain overlaps the plans. */
export function TodayWeather({ city, now, today, plans }: Props) {
  const meta = weatherMeta(now.code);
  const Icon = meta.icon;
  const windows = rainWindows(now.rainyHours);
  const hit = plans.filter((p) => windows.some((w) => p.time >= w.from && p.time < w.to));

  return (
    <section aria-label={`Clima en ${city}`} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <Icon className="size-9 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold">{now.temperature}°</span>
            <span className="text-sm text-muted-foreground">
              {meta.label} · sensación {now.feelsLike}°
            </span>
          </p>
          {today && (
            <p className="text-xs text-muted-foreground">
              Hoy en {city}: máx. {today.max}° · mín. {today.min}°
            </p>
          )}
        </div>
      </div>

      {windows.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary p-2 text-sm text-secondary-foreground">
          <Umbrella className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Lluvia probable {windows.map((w) => `${w.from}–${w.to} (hasta ${w.peak}%)`).join(", ")}
            {hit.length > 0 && <> · coincide con {hit.map((p) => `${p.title} (${p.time})`).join(", ")}</>}
          </span>
        </p>
      )}

      <a href={WEATHER_ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="self-end text-[10px] text-muted-foreground hover:underline">
        {WEATHER_ATTRIBUTION.label}
      </a>
    </section>
  );
}
