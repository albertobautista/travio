"use client";

import { useEffect, useRef, useState } from "react";

import { TravelerAvatar } from "@/components/travelers/traveler-avatar";
import { cabinRows, parseSeat, SEAT_LAYOUT_META, SEAT_LAYOUTS, sameSeat, type SeatLayout } from "@/lib/transportations/seat-map";

import { SeatMap } from "./seat-map";

type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  /** The travelers on this flight (the ones checked in "¿Quién viaja?"). */
  travelers: Traveler[];
  /** Seat per traveler id, the same values as the text inputs. */
  seats: Record<string, string>;
  onSeatsChange: (seats: Record<string, string>) => void;
  layout: SeatLayout;
  onLayoutChange: (layout: SeatLayout) => void;
};

/**
 * Tap a traveler, then a seat. The seat goes to that traveler (anyone else in
 * it loses it), tapping their own seat again frees it, and the picker moves on
 * to the next traveler who has no seat yet. It only edits `seats`: the text
 * inputs below stay the source of what is submitted.
 */
export function SeatPicker({ travelers, seats, onSeatsChange, layout, onLayoutChange }: Props) {
  const firstWithout = travelers.find((t) => !parseSeat(seats[t.id]))?.id ?? travelers[0]?.id;
  const [activeId, setActiveId] = useState(firstWithout);
  const active = travelers.some((t) => t.id === activeId) ? activeId : travelers[0]?.id;
  const scroller = useRef<HTMLDivElement>(null);

  const taken = travelers.map((t) => seats[t.id]);
  const total = cabinRows(layout, taken);
  const rows = Array.from({ length: total }, (_, i) => i + 1);

  // Open the cabin where the seats are, not at row 1.
  const firstRow = Math.min(...taken.map((s) => parseSeat(s)?.row ?? Infinity));
  useEffect(() => {
    const box = scroller.current;
    if (!box || !Number.isFinite(firstRow)) return;
    const row = box.querySelector<HTMLElement>(`[data-row="${firstRow}"]`);
    if (row) box.scrollTop = Math.max(0, row.offsetTop - 96);
    // Only when the layout changes or on first draw, not after every tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  function occupant(seat: string) {
    return travelers.find((t) => sameSeat(seats[t.id], seat));
  }

  function pick(seat: string) {
    if (!active) return;
    const next = { ...seats };
    if (sameSeat(next[active], seat)) {
      delete next[active];
    } else {
      for (const t of travelers) if (sameSeat(next[t.id], seat)) delete next[t.id];
      next[active] = seat;
      // Move on to the next traveler who still needs a seat.
      const following = travelers.find((t) => t.id !== active && !parseSeat(next[t.id]));
      if (following) setActiveId(following.id);
    }
    onSeatsChange(next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Tipo de cabina</legend>
        <div className="flex flex-wrap gap-1.5">
          {SEAT_LAYOUTS.map((l) => {
            const checked = l === layout;
            return (
              <label
                key={l}
                className={
                  "flex h-11 cursor-pointer items-center rounded-full border px-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                  (checked ? "border-primary bg-secondary font-semibold text-secondary-foreground" : "bg-card text-foreground/80 hover:bg-muted")
                }
              >
                <input type="radio" name="seat_layout_choice" value={l} checked={checked} onChange={() => onLayoutChange(l)} className="sr-only" />
                <span className="font-mono">{SEAT_LAYOUT_META[l].label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {SEAT_LAYOUT_META[layout].hint}. Es un plano genérico: las filas reales cambian según el avión.
        </p>
      </fieldset>

      {travelers.length > 1 && (
        <div className="flex flex-col gap-2" role="group" aria-label="¿De quién es el asiento?">
          <p className="text-sm font-medium">¿De quién es el asiento?</p>
          <div className="flex flex-wrap gap-1.5">
            {travelers.map((t) => {
              const selected = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveId(t.id)}
                  className={
                    "flex h-11 items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm " +
                    (selected ? "border-primary bg-secondary font-semibold text-secondary-foreground" : "bg-card text-foreground/80 hover:bg-muted")
                  }
                >
                  <TravelerAvatar traveler={t} size="sm" />
                  {t.name.split(" ")[0]}
                  {seats[t.id] && <span className="font-mono text-xs">{seats[t.id]}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={scroller} className="relative max-h-[26rem] overflow-y-auto overscroll-contain rounded-lg bg-muted/30 px-2 pb-2">
        <SeatMap layout={layout} rows={rows} occupant={occupant} size="lg" onSeat={pick} activeTravelerId={travelers.length > 1 ? active : undefined} />
      </div>
    </div>
  );
}

