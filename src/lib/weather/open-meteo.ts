import "server-only";

import type { DayWeather, NowWeather } from "./types";

/**
 * Weather from Open-Meteo (https://open-meteo.com): no API key, free for
 * non-commercial use (CC BY 4.0, attribution shown in the UI). If Travio goes
 * commercial, this is the only file to replace (or point at their paid API).
 *
 * - Up to FORECAST_DAYS ahead: the forecast API (also covers recent past days).
 * - Further out: the archive API for the same dates over the last TYPICAL_YEARS
 *   years, averaged, labeled "typical" rather than a forecast.
 *
 * Responses go through Next's data cache (fetch `next.revalidate`), keyed by
 * URL, so many visitors to the same city share one upstream request. Failures
 * return null/empty and the UI simply hides the weather.
 */

// Open-Meteo forecasts 16 days counted from its own (UTC) today; asking for
// the last one near midnight returns 400. Stay a couple of days inside it.
const FORECAST_DAYS = 13;
const TYPICAL_YEARS = 3;
const FORECAST_TTL = 60 * 60; // 1 h
const ARCHIVE_TTL = 60 * 60 * 24 * 30; // past weather doesn't change

type Place = { lat: number; lng: number; timezone: string };

/** Round coordinates (~1 km) so nearby lookups share the cache. */
const coord = (n: number) => n.toFixed(2);

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getJson<T>(url: string, ttl: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: ttl } });
    if (!res.ok) {
      console.error("Open-Meteo request failed", res.status, url);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("Open-Meteo request failed", e);
    return null;
  }
}

type DailyResponse = {
  daily?: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
};

async function forecastDays(p: Place, from: string, to: string): Promise<DayWeather[]> {
  const params = new URLSearchParams({
    latitude: coord(p.lat),
    longitude: coord(p.lng),
    timezone: p.timezone,
    start_date: from,
    end_date: to,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  });
  const data = await getJson<DailyResponse>(`https://api.open-meteo.com/v1/forecast?${params}`, FORECAST_TTL);
  const d = data?.daily;
  if (!d) return [];
  return d.time.flatMap((date, i) =>
    d.weather_code[i] == null || d.temperature_2m_max[i] == null || d.temperature_2m_min[i] == null
      ? []
      : [
          {
            date,
            code: d.weather_code[i]!,
            max: Math.round(d.temperature_2m_max[i]!),
            min: Math.round(d.temperature_2m_min[i]!),
            rainChance: d.precipitation_probability_max?.[i] ?? null,
            kind: "forecast" as const,
          },
        ],
  );
}

/** The same calendar dates in each of the last few years, averaged per date. */
async function typicalDays(p: Place, from: string, to: string, today: string): Promise<DayWeather[]> {
  const thisYear = Number(today.slice(0, 4));
  const shift = (date: string, years: number) => `${Number(date.slice(0, 4)) - years}${date.slice(4)}`;
  const years = Array.from({ length: TYPICAL_YEARS }, (_, i) => i + 1 + (Number(from.slice(0, 4)) - thisYear));
  const responses = await Promise.all(
    years.map((back) => {
      const params = new URLSearchParams({
        latitude: coord(p.lat),
        longitude: coord(p.lng),
        timezone: p.timezone,
        start_date: shift(from, back),
        end_date: shift(to, back),
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
      });
      return getJson<DailyResponse>(`https://archive-api.open-meteo.com/v1/archive?${params}`, ARCHIVE_TTL);
    }),
  );

  // Group by "MM-DD" so leap years and year boundaries line up.
  const byDay = new Map<string, { codes: number[]; max: number[]; min: number[] }>();
  for (const r of responses) {
    r?.daily?.time.forEach((date, i) => {
      const d = r.daily!;
      if (d.weather_code[i] == null || d.temperature_2m_max[i] == null || d.temperature_2m_min[i] == null) return;
      const key = date.slice(5);
      const e = byDay.get(key) ?? { codes: [], max: [], min: [] };
      e.codes.push(d.weather_code[i]!);
      e.max.push(d.temperature_2m_max[i]!);
      e.min.push(d.temperature_2m_min[i]!);
      byDay.set(key, e);
    });
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const out: DayWeather[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const e = byDay.get(date.slice(5));
    if (!e) continue;
    // The most frequent sky across the years; ties go to the first seen.
    const code = [...new Set(e.codes)].sort((a, b) => e.codes.filter((c) => c === b).length - e.codes.filter((c) => c === a).length)[0];
    out.push({ date, code, max: avg(e.max), min: avg(e.min), rainChance: null, kind: "typical" });
  }
  return out;
}

/**
 * Daily weather for `from`..`to` at a place: forecast where possible,
 * typical weather beyond the forecast horizon. `today` is the local date there.
 */
export async function getDailyWeather(p: Place, from: string, to: string, today: string): Promise<Map<string, DayWeather>> {
  const horizon = addDays(today, FORECAST_DAYS);
  const earliestForecast = addDays(today, -60); // the forecast API keeps ~3 months of past days
  const parts: Promise<DayWeather[]>[] = [];

  const fStart = from < earliestForecast ? earliestForecast : from;
  const fEnd = to > horizon ? horizon : to;
  if (fStart <= fEnd) parts.push(forecastDays(p, fStart, fEnd));
  if (to > horizon) parts.push(typicalDays(p, from > horizon ? from : addDays(horizon, 1), to, today));

  const days = (await Promise.all(parts)).flat();
  return new Map(days.map((d) => [d.date, d]));
}

type NowResponse = {
  current?: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number };
  hourly?: { time: string[]; precipitation_probability: (number | null)[] };
};

/** Current conditions and today's rainy hours (chance ≥ 40%). */
export async function getNowWeather(p: Place, today: string): Promise<NowWeather | null> {
  const params = new URLSearchParams({
    latitude: coord(p.lat),
    longitude: coord(p.lng),
    timezone: p.timezone,
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    hourly: "precipitation_probability",
    start_date: today,
    end_date: today,
  });
  // Shorter cache: "now" should feel current.
  const data = await getJson<NowResponse>(`https://api.open-meteo.com/v1/forecast?${params}`, 15 * 60);
  if (!data?.current) return null;
  const h = data.hourly;
  return {
    code: data.current.weather_code,
    temperature: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    isDay: data.current.is_day === 1,
    rainyHours: h
      ? h.time.flatMap((t, i) => ((h.precipitation_probability[i] ?? 0) >= 40 ? [{ time: t.slice(11, 16), chance: h.precipitation_probability[i]! }] : []))
      : [],
  };
}
