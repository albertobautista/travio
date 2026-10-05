"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";

import {
  autoMode,
  MARGIN_MINUTES,
  TRAVEL_MODE_META,
  TRAVEL_MODES,
  travelVerdict,
  type Point,
  type TravelMode,
} from "@/lib/maps/travel";
import { formatDuration } from "@/lib/activities/schedule";
import { formatClock, useTravelTime } from "@/lib/maps/use-travel-time";

import { setTravelMode } from "@/app/viajes/[id]/actividades/actions";

type Props = {
  tripId: string;
  /** The activity you travel to (its travel_mode says how). */
  toActivityId: string;
  toTitle: string;
  from: Point;
  to: Point;
  /**
   * Minutes between the end of one and the start of the next, or null when
   * leaving from the hotel (no gap to check: it says when to leave instead).
   */
  gapMinutes: number | null;
  /** Where you leave from when it isn't the previous activity ("Casa Bonay"). */
  fromLabel?: string;
  /** Roughly when you set off (ISO): transit uses it for the timetable. */
  departAt: string;
  /** When the activity starts (ISO) and its time zone, for "sal a las…". */
  arriveAt: string;
  timeZone: string;
  mode: TravelMode | null;
  editable: boolean;
};

const formatKm = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * The trip between two activities in the timeline: how long it takes and
 * whether the gap is enough. Asks the Routes API only once the row is on
 * screen, so a long day doesn't fire every request up front.
 */
export function TravelGap({
  tripId,
  toActivityId,
  toTitle,
  from,
  to,
  gapMinutes,
  fromLabel,
  departAt,
  arriveAt,
  timeZone,
  mode,
  editable,
}: Props) {
  const row = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const effective = mode ?? autoMode(from, to);
  const time = useTravelTime(from, to, effective, departAt, visible);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const verdict = time && gapMinutes !== null ? travelVerdict(gapMinutes, time.minutes) : null;
  const leaveAt = time ? formatClock(new Date(Date.parse(arriveAt) - time.minutes * 60_000), timeZone) : null;
  const Icon = TRAVEL_MODE_META[effective].icon;
  const tone =
    verdict === "late"
      ? "border-warning-border bg-warning-soft text-warning-foreground"
      : verdict === "tight"
        ? "border-warning-border/60 bg-card text-warning-foreground"
        : "border-transparent bg-muted text-foreground/70";

  return (
    <li ref={row} className="flex items-center gap-2.5" aria-live="polite">
      {/* Same columns as the timeline rows: dot, time, then content. */}
      <span className="w-3 shrink-0" aria-hidden="true" />
      <span className="w-11 shrink-0" aria-hidden="true" />
      <div className={"flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-1.5 py-1 text-xs " + tone}>
        {editable ? (
          // The mode chip: a native <select> laid invisibly over the icon, so it's
          // compact but still a real, accessible select (and the phone's picker).
          <label className="relative flex h-7 shrink-0 items-center gap-0.5 rounded-md border bg-card px-1.5 text-foreground focus-within:ring-2 focus-within:ring-ring/50">
            {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
            <select
              aria-label={`Cómo llegar a ${toTitle}`}
              value={mode ?? ""}
              disabled={saving}
              onChange={(e) => {
                const next = e.target.value || null;
                setError(null);
                startSaving(async () => {
                  const r = await setTravelMode(tripId, toActivityId, next);
                  if (r.error) setError(r.error);
                });
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">Automático ({TRAVEL_MODE_META[autoMode(from, to)].label.toLowerCase()})</option>
              {TRAVEL_MODES.map((m) => (
                <option key={m} value={m}>
                  {TRAVEL_MODE_META[m].label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        {verdict === "late" && <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}
        {!time ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Calculando traslado…
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            {fromLabel && <>Desde {fromLabel} · </>}
            <span className="font-medium">
              {time.estimated ? "≈ " : ""}
              {formatDuration(time.minutes)} {TRAVEL_MODE_META[effective].short}
            </span>
            {time.meters !== null && ` · ${formatKm(time.meters)}`}
            {" · "}
            {gapMinutes === null
              ? `sal a las ${leaveAt}`
              : verdict === "late"
                ? `No alcanzas: tienes ${formatDuration(gapMinutes)}, faltan ${formatDuration(time.minutes - gapMinutes)}`
                : verdict === "tight"
                  ? `Justo: ${formatDuration(gapMinutes - time.minutes)} de margen (recomendado ${MARGIN_MINUTES} min)`
                  : `te sobran ${formatDuration(gapMinutes - time.minutes)}`}
            {time.estimated && <span title="Estimado en línea recta: no se pudo consultar la ruta."> · aprox.</span>}
          </span>
        )}
        {error && (
          <span role="alert" className="w-full text-destructive">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}
