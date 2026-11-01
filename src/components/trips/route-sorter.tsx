"use client";

import { useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { moveStop, reorderStops } from "@/app/viajes/[id]/ciudades/actions";
import { Button } from "@/components/ui/button";

type Item = { id: string; name: string; content: ReactNode };

type Drag = {
  id: string;
  from: number;
  pointerId: number;
  /** Where the pointer started, in page coordinates (survives scrolling). */
  startY: number;
  /** Each row's top and height when the drag started, in page coordinates. */
  rows: { top: number; height: number }[];
  /** How far the pointer has moved, and the place the city would drop into. */
  dy: number;
  over: number;
};

/** Moves the item at `from` to `to`, shifting the ones in between. */
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The route's cities while sorting ("Ordenar"): drag a city by its handle, or
 * use ↑/↓. Dragging uses pointer events, so the same code serves mouse, touch
 * and pen; the handle has `touch-action: none` so on a phone the finger moves
 * the city instead of scrolling the page (the rest of the row still scrolls).
 *
 * The new order shows right away and is saved in the background
 * (reorderStops); if saving fails, the list goes back to what's stored.
 * The ↑/↓ buttons are plain forms: they work before JavaScript loads and
 * from the keyboard.
 */
export function RouteSorter({ tripId, items }: { tripId: string; items: Item[] }) {
  const serverOrder = items.map((item) => item.id).join(",");
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  const [seenOrder, setSeenOrder] = useState(serverOrder);
  // The server's order changed (↑/↓, another device, a saved drag): follow it.
  if (seenOrder !== serverOrder) {
    setSeenOrder(serverOrder);
    setOrder(items.map((item) => item.id));
  }

  const [drag, setDrag] = useState<Drag | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(items.map((item) => [item.id, item]));
  // Ids the server doesn't know (yet) are skipped; new ones go last.
  const ids = [...order.filter((id) => byId.has(id)), ...items.map((item) => item.id).filter((id) => !order.includes(id))];

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (saving || drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = ids.indexOf(id);
    setError(null);
    setDrag({
      id,
      from,
      dy: 0,
      over: from,
      pointerId: event.pointerId,
      startY: event.clientY + window.scrollY,
      rows: ids.map((rowId) => {
        const rect = rowRefs.current.get(rowId)?.getBoundingClientRect();
        return { top: (rect?.top ?? 0) + window.scrollY, height: rect?.height ?? 0 };
      }),
    });
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag;
    if (!current || event.pointerId !== current.pointerId) return;
    // Near the top or bottom of the screen, scroll so long routes can be crossed.
    const edge = 72;
    if (event.clientY < edge) window.scrollBy(0, -12);
    else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);

    const dy = event.clientY + window.scrollY - current.startY;
    const dragged = current.rows[current.from];
    const center = dragged.top + dragged.height / 2 + dy;
    // The new place = how many of the other cities are now above the dragged one.
    const over = current.rows.filter((row, i) => i !== current.from && row.top + row.height / 2 < center).length;
    setDrag({ ...current, dy, over });
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    const current = drag;
    if (!current || event.pointerId !== current.pointerId) return;
    const to = current.over;
    setDrag(null);
    if (cancelled || to === current.from) return;

    const previous = ids;
    const next = moveItem(ids, current.from, to);
    setOrder(next);
    startSaving(async () => {
      const result = await reorderStops(tripId, next);
      if (result.error) {
        setOrder(previous);
        setError(result.error);
      }
    });
  }

  /** How far a row slides while another one is dragged past it. */
  function offsetOf(index: number) {
    if (!drag) return 0;
    const { from, over } = drag;
    if (index === from) return drag.dy;
    const height = drag.rows[from].height;
    if (from < over && index > from && index <= over) return -height;
    if (over < from && index >= over && index < from) return height;
    return 0;
  }

  return (
    <>
      {ids.map((id, index) => {
        const item = byId.get(id)!;
        const dragging = drag?.id === id;
        const offset = offsetOf(index);
        return (
          <li
            key={id}
            ref={(node) => {
              if (node) rowRefs.current.set(id, node);
              else rowRefs.current.delete(id);
            }}
            style={offset ? { transform: `translateY(${offset}px)` } : undefined}
            className={
              "flex items-center gap-1 py-1.5 " +
              (dragging
                ? "relative z-10 rounded-xl bg-card shadow-lg ring-1 ring-border"
                : drag
                  ? "transition-transform duration-150 ease-out"
                  : "")
            }
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">{item.content}</span>
            <span className="flex shrink-0 animate-rise">
              <form action={moveStop.bind(null, id, -1)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={index === 0 || saving}
                  aria-label={`Mover ${item.name} antes`}
                >
                  <ChevronUp aria-hidden="true" />
                </Button>
              </form>
              <form action={moveStop.bind(null, id, 1)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={index === ids.length - 1 || saving}
                  aria-label={`Mover ${item.name} después`}
                >
                  <ChevronDown aria-hidden="true" />
                </Button>
              </form>
              {/* Mouse and touch only: the ↑/↓ buttons cover the keyboard and screen readers. */}
              <span
                aria-hidden="true"
                title="Arrastrar para ordenar"
                onPointerDown={(event) => onPointerDown(event, id)}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => onPointerEnd(event, false)}
                onPointerCancel={(event) => onPointerEnd(event, true)}
                className={
                  "flex size-11 touch-none items-center justify-center rounded-md text-muted-foreground select-none hover:bg-muted " +
                  (saving ? "opacity-50" : dragging ? "cursor-grabbing" : "cursor-grab")
                }
              >
                <GripVertical className="size-5" />
              </span>
            </span>
          </li>
        );
      })}
      {(error || saving) && (
        <li role={error ? "alert" : "status"} className={"py-1 pl-10 text-xs " + (error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? "Guardando el orden…"}
        </li>
      )}
    </>
  );
}
