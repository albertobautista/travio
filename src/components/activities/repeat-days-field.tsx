"use client";

import { Repeat } from "lucide-react";

import { formatDayLabel } from "@/lib/activities/itinerary";
import { stopForDate } from "@/lib/trips/stops";

type Stop = { id: string; name: string; arrives_on: string | null; departs_on: string | null };

type Props = {
  /** Every date of the trip. */
  dates: string[];
  /** The activity's own day, which can't be picked. */
  date: string;
  stops: Stop[];
  /** The activity's city, to point out days spent in another one. */
  stopId: string;
  /** Days that already have an activity with this name (an earlier repeat). */
  alreadyOn: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Editing an existing activity: its copies are new activities. */
  editing: boolean;
};

/**
 * "Repetir otros días": day chips submitted as `repeat_dates` checkboxes.
 * Each checked day becomes its own activity when saving (see
 * lib/activities/repeat.ts).
 */
export function RepeatDaysField({
  dates,
  date,
  stops,
  stopId,
  alreadyOn,
  open,
  onOpenChange,
  selected,
  onChange,
  editing,
}: Props) {
  const pickable = dates.filter((d) => d !== date);
  if (pickable.length === 0) return null;
  const free = pickable.filter((d) => !alreadyOn.has(d));
  const chosen = pickable.filter((d) => selected.has(d));
  const allChosen = free.length > 0 && free.every((d) => selected.has(d));
  const otherCity = stopId !== "" && chosen.some((d) => {
    const stop = stopForDate(stops, d);
    return stop && stop.id !== stopId && !coversDay(stops.find((s) => s.id === stopId), d);
  });

  function toggle(d: string) {
    const next = new Set(selected);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    onChange(next);
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
      <legend className="sr-only">Repetir otros días</legend>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Repeat className="size-4 text-primary-text" aria-hidden="true" />
          {editing ? "Repetir también otros días" : "Se repite otros días"}
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={open}
          onChange={(e) => onOpenChange(e.target.checked)}
          className="size-5 accent-primary"
        />
      </label>

      {open && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {chosen.length === 0
                ? "Marca los días."
                : `${chosen.length} ${chosen.length === 1 ? "día más" : "días más"}, misma hora y duración.`}
            </p>
            <button
              type="button"
              onClick={() => onChange(allChosen ? new Set() : new Set(free))}
              className="min-h-11 shrink-0 px-1 text-sm font-medium text-primary-text hover:underline"
            >
              {allChosen ? "Quitar todos" : "Todos los días"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => {
              const own = d === date;
              const checked = own || selected.has(d);
              const city = stopForDate(stops, d)?.name;
              const note = own ? "Este día" : alreadyOn.has(d) ? "Ya está" : city;
              return (
                <label
                  key={d}
                  className={
                    "flex min-h-11 flex-col justify-center rounded-xl border px-3 py-1 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                    (own
                      ? "cursor-default border-primary/40 bg-muted text-muted-foreground"
                      : checked
                        ? "cursor-pointer border-primary bg-secondary font-medium text-secondary-foreground"
                        : "cursor-pointer bg-card text-foreground/80")
                  }
                >
                  <input
                    type="checkbox"
                    name={own ? undefined : "repeat_dates"}
                    value={d}
                    checked={checked}
                    disabled={own}
                    onChange={() => toggle(d)}
                    className="sr-only"
                  />
                  <span>{formatDayLabel(d)}</span>
                  {note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {editing
              ? "Se crea una actividad nueva en cada día marcado. Las que ya existen no cambian."
              : "Se crea una actividad en cada día: luego puedes cambiar o borrar cualquiera sin tocar las demás."}
            {otherCity && " En los días de otra ciudad se guarda en esa ciudad y sin lugar."}
          </p>
        </>
      )}
    </fieldset>
  );
}

function coversDay(stop: Stop | undefined, d: string) {
  return Boolean(stop?.arrives_on && stop.arrives_on <= d && d <= (stop.departs_on ?? stop.arrives_on));
}
