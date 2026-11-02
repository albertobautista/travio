"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Drag = {
  from: number;
  pointerId: number;
  /** Where the pointer started, in page coordinates (survives scrolling). */
  startY: number;
  /** Each row's top and height when the drag started, in page coordinates. */
  rows: { top: number; height: number }[];
  /** How far the pointer has moved. */
  dy: number;
  /** The place the row would drop into (an index in the list without it). */
  over: number;
};

/** Moves the item at `from` to `to`, shifting the ones in between. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Drag to reorder a vertical list, by a handle. Pointer events, so the same
 * code serves mouse, touch and pen; the handle gets `touch-action: none` so
 * on a phone the finger moves the row instead of scrolling the page (the rest
 * of the row still scrolls). No keyboard support here: lists that use it keep
 * buttons for that.
 *
 * While dragging, the dragged row follows the pointer and the rows it passes
 * slide out of the way (`offsetOf`). On release `onDrop(from, to)` is called
 * if the place changed.
 */
export function useDragSort({
  count,
  disabled = false,
  onDrop,
}: {
  count: number;
  disabled?: boolean;
  onDrop: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const rowRefs = useRef(new Map<number, HTMLElement>());

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, index: number) {
    if (disabled || drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rows = Array.from({ length: count }, (_, i) => {
      const rect = rowRefs.current.get(i)?.getBoundingClientRect();
      return { top: (rect?.top ?? 0) + window.scrollY, height: rect?.height ?? 0 };
    });
    setDrag({ from: index, pointerId: event.pointerId, startY: event.clientY + window.scrollY, rows, dy: 0, over: index });
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    // Near the top or bottom of the screen, scroll so long lists can be crossed.
    const edge = 72;
    if (event.clientY < edge) window.scrollBy(0, -12);
    else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);

    const dy = event.clientY + window.scrollY - drag.startY;
    const dragged = drag.rows[drag.from];
    const center = dragged.top + dragged.height / 2 + dy;
    // The new place = how many of the other rows are now above the dragged one.
    const over = drag.rows.filter((row, i) => i !== drag.from && row.top + row.height / 2 < center).length;
    setDrag({ ...drag, dy, over });
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!cancelled && drag.over !== drag.from) onDrop(drag.from, drag.over);
  }

  /** How far a row slides: the dragged one follows the pointer, the ones it passes make room. */
  function offsetOf(index: number) {
    if (!drag) return 0;
    const { from, over } = drag;
    if (index === from) return drag.dy;
    // The dragged row's height plus the list's gap between rows.
    const [first, second] = drag.rows;
    const gap = second ? Math.max(0, second.top - first.top - first.height) : 0;
    const height = drag.rows[from].height + gap;
    if (from < over && index > from && index <= over) return -height;
    if (over < from && index >= over && index < from) return height;
    return 0;
  }

  return {
    /** null when nothing is being dragged. */
    drag: drag && { from: drag.from, over: drag.over },
    offsetOf,
    rowRef: (index: number) => (node: HTMLElement | null) => {
      if (node) rowRefs.current.set(index, node);
      else rowRefs.current.delete(index);
    },
    handleProps: (index: number) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => onPointerDown(event, index),
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => onPointerEnd(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => onPointerEnd(event, true),
    }),
  };
}
