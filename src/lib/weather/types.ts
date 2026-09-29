import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";

/**
 * Weather as the app sees it, independent of the provider (see open-meteo.ts).
 * Client-safe: components import these types and the code table.
 */

export type DayWeather = {
  date: string;
  /** WMO weather code (the scale Open-Meteo and most providers use). */
  code: number;
  max: number;
  min: number;
  /** Chance of rain in % (forecasts) or null (typical weather has no chance, see rainyDays). */
  rainChance: number | null;
  /** "forecast" for the next ~16 days; "typical" = average of past years for the same dates. */
  kind: "forecast" | "typical";
};

export type NowWeather = {
  code: number;
  temperature: number;
  feelsLike: number;
  isDay: boolean;
  /** Today's hours with a real chance of rain, "HH:MM" local → %, to warn about outdoor plans. */
  rainyHours: { time: string; chance: number }[];
};

type CodeMeta = { label: string; icon: LucideIcon; rainy: boolean };

/** WMO codes grouped the way a traveler cares about them. */
export function weatherMeta(code: number): CodeMeta {
  if (code === 0) return { label: "Despejado", icon: Sun, rainy: false };
  if (code <= 2) return { label: "Parcialmente nublado", icon: CloudSun, rainy: false };
  if (code === 3) return { label: "Nublado", icon: Cloud, rainy: false };
  if (code === 45 || code === 48) return { label: "Niebla", icon: CloudFog, rainy: false };
  if (code >= 51 && code <= 57) return { label: "Llovizna", icon: CloudDrizzle, rainy: true };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Lluvia", icon: CloudRain, rainy: true };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Nieve", icon: CloudSnow, rainy: true };
  if (code >= 95) return { label: "Tormenta", icon: CloudLightning, rainy: true };
  return { label: "Variable", icon: CloudSun, rainy: false };
}

/** Rain worth mentioning: a rainy code or a forecast chance of 40% or more. */
export const looksRainy = (d: DayWeather) => weatherMeta(d.code).rainy || (d.rainChance ?? 0) >= 40;

/** Summary of a stay: average highs/lows, the most common sky, and how many days look rainy. */
export function summarize(days: DayWeather[]) {
  if (days.length === 0) return null;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const counts = new Map<number, number>();
  for (const d of days) counts.set(d.code, (counts.get(d.code) ?? 0) + 1);
  const code = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return {
    code,
    max: avg(days.map((d) => d.max)),
    min: avg(days.map((d) => d.min)),
    rainyDays: days.filter(looksRainy).length,
    kind: days.some((d) => d.kind === "typical") ? ("typical" as const) : ("forecast" as const),
  };
}

export const WEATHER_ATTRIBUTION = { label: "Clima: Open-Meteo", href: "https://open-meteo.com/" };
