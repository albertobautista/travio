"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { moveActivityStart } from "@/app/viajes/[id]/actividades/actions";
import { useDragSort } from "@/components/sortable/use-drag-sort";
import { Button } from "@/components/ui/button";
import { dropActivity } from "@/lib/activities/reorder";
import { instantToZonedTime } from "@/lib/zoned-time";

export type SortRow = {
  key: string;
  /** ISO instants. */
  start: string;
  end: string;
  timezone: string;
  /** Activities can be dragged; legs and check-ins stay where their times put them. */
  activity?: { id: string; title: string; durationMinutes: number };
  /** Icon and title, drawn by the page. */
  content: ReactNode;
};

const ms = (iso: string) => new Date(iso).getTime();

/**
 * The day's timeline while sorting ("Ordenar" in the itinerary). Activities
 * are ordered by their time, so moving one means changing its start:
 * dropped after a row it starts when that row ends, dropped first it ends as
 * the next one begins (dropActivity). Only the moved activity changes. Legs
 * and check-ins have fixed times, so they don't move but can be dropped around.
 *
 * Drag by the handle (mouse or touch), or use ↑/↓. While dragging, the time
 * shows where it would start. The change shows at once and is saved in the
 * background (moveActivityStart); on failure the old time comes back.
 */
export function DaySorter({ tripId, rows: serverRows }: { tripId: string; rows: SortRow[] }) {
  const signature = serverRows.map((r) => `${r.key}@${r.start}`).join(",");
  const [moved, setMoved] = useState(new Map<string, string>());
  const [seen, setSeen] = useState(signature);
  // New data from the server (a saved move, another device): drop local guesses.
  if (seen !== signature) {
    setSeen(signature);
    setMoved(new Map());
  }

  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local moves applied, then sorted by time like the real timeline.
  const rows = serverRows
    .map((row) => {
      const start = moved.get(row.key);
      if (!start || !row.activity) return row;
      return { ...row, start, end: new Date(ms(start) + row.activity.durationMinutes * 60_000).toISOString() };
    })
    .sort((a, b) => ms(a.start) - ms(b.start));

  /** Where rows[from] would start if dropped at place `to`, or why it can't. */
  function placeAt(from: number, to: number) {
    const row = rows[from];
    if (!row.activity) return null;
    const others = rows.filter((_, i) => i !== from).map((r) => ({ start: ms(r.start), end: ms(r.end) }));
    return dropActivity({ starts_at: row.start, timezone: row.timezone, duration_minutes: row.activity.durationMinutes }, others, to);
  }

  function move(from: number, to: number) {
    const row = rows[from];
    const result = placeAt(from, to);
    if (!row.activity || !result) return;
    if ("error" in result) {
      setError(`${row.activity.title}: ${result.error}`);
      return;
    }
    const previous = serverRows.find((r) => r.key === row.key)!.start;
    setError(null);
    setMoved(new Map(moved).set(row.key, result.startsAt));
    startSaving(async () => {
      const saved = await moveActivityStart(tripId, row.activity!.id, result.startsAt, previous);
      if (saved.error) {
        setMoved((current) => {
          const next = new Map(current);
          next.delete(row.key);
          return next;
        });
        setError(saved.error);
      }
    });
  }

  const sort = useDragSort({ count: rows.length, disabled: saving, onDrop: move });
  const preview = sort.drag ? placeAt(sort.drag.from, sort.drag.over) : null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Arrastra una actividad: empezará cuando termine lo anterior. Las demás no cambian de hora.
      </p>
      <ol className="relative flex flex-col gap-2">
        <span aria-hidden="true" className="absolute top-5 bottom-5 left-[5px] w-0.5 bg-timeline" />
        {rows.map((row, index) => {
          const dragging = sort.drag?.from === index;
          const offset = sort.offsetOf(index);
          const time = instantToZonedTime(row.start, row.timezone).time;
          const shownTime =
            dragging && preview ? ("startsAt" in preview ? instantToZonedTime(preview.startsAt, row.timezone).time : "--:--") : time;
          return (
            <li
              key={row.key}
              ref={sort.rowRef(index)}
              style={offset ? { transform: `translateY(${offset}px)` } : undefined}
              className={
                "flex items-center gap-2.5 " +
                (dragging ? "relative z-10" : sort.drag ? "transition-transform duration-150 ease-out" : "")
              }
            >
              <span
                aria-hidden="true"
                className={"relative size-3 shrink-0 rounded-full border-2 " + (row.activity ? "border-card bg-primary" : "border-primary bg-card")}
              />
              <time
                dateTime={row.start}
                className={"w-11 shrink-0 font-mono text-xs font-semibold " + (dragging && shownTime !== time ? "text-primary" : "")}
              >
                {shownTime}
              </time>
              <span
                className={
                  "flex min-h-14 min-w-0 flex-1 items-center gap-1 rounded-[14px] border py-1 pr-1 pl-2.5 " +
                  (row.activity ? "bg-card" : "border-dashed bg-secondary/40") +
                  (dragging ? " shadow-lg ring-1 ring-border" : "")
                }
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">{row.content}</span>
                {row.activity && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sr-only size-11 sm:not-sr-only"
                      disabled={index === 0 || saving}
                      onClick={() => move(index, index - 1)}
                      aria-label={`Mover ${row.activity.title} antes`}
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="sr-only size-11 sm:not-sr-only"
                      disabled={index === rows.length - 1 || saving}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Mover ${row.activity.title} después`}
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                    {/* Mouse and touch only: the buttons cover the keyboard and screen readers
                        (on phones they're left to screen readers, there's no room for three). */}
                    <span
                      aria-hidden="true"
                      title="Arrastrar para ordenar"
                      {...sort.handleProps(index)}
                      className={
                        "flex size-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground select-none hover:bg-muted " +
                        (saving ? "opacity-50" : dragging ? "cursor-grabbing" : "cursor-grab")
                      }
                    >
                      <GripVertical className="size-5" />
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {sort.drag && preview && "error" in preview && (
        <p className="flex items-center gap-1.5 text-xs text-warning-foreground">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {preview.error}
        </p>
      )}
      {(error || saving) && (
        <p role={error ? "alert" : "status"} className={"text-xs " + (error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? "Guardando…"}
        </p>
      )}
    </div>
  );
}
