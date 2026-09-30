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

/**
 * Kinds of sky, from mildest to worst. Codes that look different but feel the
 * same to a traveler go together: fog is a grey day, drizzle is rain.
 */
const FAMILIES = ["clear", "partly", "cloudy", "rain", "snow", "storm"] as const;
type Family = (typeof FAMILIES)[number];

function familyOf(code: number): Family {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "partly";
}

/**
 * The sky that best describes several days (a stay in a city).
 *
 * Counting exact codes picks odd winners: 2 foggy mornings beat 2 overcast
 * and 3 sunny-ish days split between "clear" and "partly cloudy", so a week
 * in Barcelona came out as "Niebla". Instead:
 *   1. Group days by family (clear, partly, cloudy, rain, snow, storm).
 *   2. The family with most days wins; a tie goes to the worse sky, since
 *      that's the one worth packing for.
 *   3. Within it, the most common code (a tie again to the worse one),
 *      except fog, which only shows when it's most of the stay.
 */
export function representativeCode(codes: number[]): number | null {
  if (codes.length === 0) return null;
  const byFamily = new Map<Family, number[]>();
  for (const c of codes) byFamily.set(familyOf(c), [...(byFamily.get(familyOf(c)) ?? []), c]);
  const rank = (f: Family) => FAMILIES.indexOf(f);
  const [, members] = [...byFamily].sort((a, b) => b[1].length - a[1].length || rank(b[0]) - rank(a[0]))[0];

  // Within the family, count by sky as shown (51 and 53 are both "Llovizna").
  const isFog = (c: number) => c === 45 || c === 48;
  const fogDays = codes.filter(isFog).length;
  const byLabel = new Map<string, number[]>();
  for (const c of members) {
    if (isFog(c) && fogDays * 2 <= codes.length) continue; // fog only when it's most of the stay
    const label = weatherMeta(c).label;
    byLabel.set(label, [...(byLabel.get(label) ?? []), c]);
  }
  // All the cloudy days were fog, but not most of the stay: call it cloudy.
  if (byLabel.size === 0) return 3;
  const worst = (xs: number[]) => Math.max(...xs);
  const [, sky] = [...byLabel].sort((a, b) => b[1].length - a[1].length || worst(b[1]) - worst(a[1]))[0];
  return worst(sky);
}

/** Summary of a stay: average highs/lows, the sky that best describes it, and how many days look rainy. */
export function summarize(days: DayWeather[]) {
  if (days.length === 0) return null;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const code = representativeCode(days.map((d) => d.code))!;
  return {
    code,
    max: avg(days.map((d) => d.max)),
    min: avg(days.map((d) => d.min)),
    rainyDays: days.filter(looksRainy).length,
    kind: days.some((d) => d.kind === "typical") ? ("typical" as const) : ("forecast" as const),
  };
}

export const WEATHER_ATTRIBUTION = { label: "Clima: Open-Meteo", href: "https://open-meteo.com/" };
