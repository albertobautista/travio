import { Umbrella } from "lucide-react";

import { WEATHER_ATTRIBUTION, weatherMeta, type DayWeather, type NowWeather } from "@/lib/weather/types";

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

/** Compact weather for the "Hoy" header: icon, temperature, sky, and today's range. */
export function WeatherNow({ city, now, today }: { city: string; now: NowWeather; today: DayWeather | null }) {
  const meta = weatherMeta(now.code);
  const Icon = meta.icon;
  return (
    <div
      className="flex shrink-0 flex-col items-end gap-0.5"
      role="group"
      aria-label={`Clima en ${city}: ${now.temperature}°, ${meta.label}, sensación ${now.feelsLike}°${today ? `, máxima ${today.max}°, mínima ${today.min}°` : ""}`}
    >
      <p className="flex items-center gap-1.5" aria-hidden="true">
        <Icon className="size-6 text-primary" />
        <span className="font-mono text-xl font-bold">{now.temperature}°</span>
      </p>
      <p className="max-w-28 truncate text-right text-xs text-muted-foreground" aria-hidden="true">
        {meta.label}
      </p>
      {today && (
        <p className="text-xs text-muted-foreground" aria-hidden="true">
          {today.max}° / {today.min}°
        </p>
      )}
      <a
        href={WEATHER_ATTRIBUTION.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] text-muted-foreground hover:underline"
      >
        {WEATHER_ATTRIBUTION.label}
      </a>
    </div>
  );
}

/**
 * Rain later today, and which plans it hits. Nothing when it isn't expected
 * to rain.
 */
export function RainNotice({ now, plans }: { now: NowWeather; plans: { title: string; time: string }[] }) {
  const windows = rainWindows(now.rainyHours);
  if (windows.length === 0) return null;
  const hit = plans.filter((p) => windows.some((w) => p.time >= w.from && p.time < w.to));
  return (
    <p className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
      <Umbrella className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Lluvia probable {windows.map((w) => `${w.from}–${w.to} (hasta ${w.peak}%)`).join(", ")}
        {hit.length > 0 && <> · coincide con {hit.map((p) => `${p.title} (${p.time})`).join(", ")}</>}
      </span>
    </p>
  );
}
