"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { moveStop, reorderStops } from "@/app/viajes/[id]/ciudades/actions";
import { moveItem, useDragSort } from "@/components/sortable/use-drag-sort";
import { Button } from "@/components/ui/button";

type Item = { id: string; name: string; content: ReactNode };

/**
 * The route's cities while sorting ("Ordenar"): drag a city by its handle
 * (useDragSort: mouse and touch), or use ↑/↓.
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

  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(items.map((item) => [item.id, item]));
  // Ids the server doesn't know (yet) are skipped; new ones go last.
  const ids = [...order.filter((id) => byId.has(id)), ...items.map((item) => item.id).filter((id) => !order.includes(id))];

  const sort = useDragSort({
    count: ids.length,
    disabled: saving,
    onDrop(from, to) {
      const previous = ids;
      const next = moveItem(ids, from, to);
      setError(null);
      setOrder(next);
      startSaving(async () => {
        const result = await reorderStops(tripId, next);
        if (result.error) {
          setOrder(previous);
          setError(result.error);
        }
      });
    },
  });

  return (
    <>
      {ids.map((id, index) => {
        const item = byId.get(id)!;
        const dragging = sort.drag?.from === index;
        const offset = sort.offsetOf(index);
        return (
          <li
            key={id}
            ref={sort.rowRef(index)}
            style={offset ? { transform: `translateY(${offset}px)` } : undefined}
            className={
              "flex items-center gap-1 py-1.5 " +
              (dragging
                ? "relative z-10 rounded-xl bg-card shadow-lg ring-1 ring-border"
                : sort.drag
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
                {...sort.handleProps(index)}
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
