import { Umbrella } from "lucide-react";

import { weatherMeta } from "@/lib/weather/types";

type Props = {
  code: number;
  max: number;
  min: number;
  /** Forecast chance of rain (%), shown when it's worth an umbrella. */
  rainChance?: number | null;
  /** Typical weather (past years), not a forecast: said so in the label. */
  typical?: boolean;
};

/** "☀️ 26° / 17°", with an umbrella when rain is likely. Works in server and client components. */
export function WeatherChip({ code, max, min, rainChance, typical }: Props) {
  const meta = weatherMeta(code);
  const Icon = meta.icon;
  const rain = rainChance != null && rainChance >= 40;
  const description = `${typical ? "Normalmente " : ""}${meta.label.toLowerCase()}, máxima ${max}°, mínima ${min}°${rain ? `, ${rainChance}% de lluvia` : ""}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" title={description}>
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="sr-only">{description}</span>
      <span aria-hidden="true" className="font-mono">
        {max}° <span className="text-muted-foreground">/ {min}°</span>
      </span>
      {rain && (
        <span aria-hidden="true" className="inline-flex items-center gap-0.5 text-xs text-primary">
          <Umbrella className="size-3.5" />
          {rainChance}%
        </span>
      )}
      {typical && (
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          (típico)
        </span>
      )}
    </span>
  );
}
