/**
 * Generic cabin layouts for the flight seat map. No airline or aircraft
 * data: a layout is only the seat letters of each block between aisles,
 * "3-3" = A B C | D E F. Letters follow the usual convention (I is skipped,
 * twin-aisle 2-4-2 cabins use A C · D E F G · H K). A seat whose letter is
 * not in the layout is still saved and listed, just not drawn.
 */

/** Mirrors the check constraint on transportations.seat_layout. */
export const SEAT_LAYOUTS = ["2-2", "3-3", "2-4-2", "3-3-3", "3-4-3"] as const;
export type SeatLayout = (typeof SEAT_LAYOUTS)[number];

type LayoutMeta = {
  label: string;
  /** Example aircraft, so people can recognize their plane. */
  hint: string;
  blocks: string[][];
  /** Rows drawn when nobody has a seat further back. */
  rows: number;
};

export const SEAT_LAYOUT_META: Record<SeatLayout, LayoutMeta> = {
  "2-2": { label: "2-2", hint: "Regional (Embraer, ATR)", blocks: [["A", "C"], ["D", "F"]], rows: 25 },
  "3-3": { label: "3-3", hint: "Un pasillo (A320, 737)", blocks: [["A", "B", "C"], ["D", "E", "F"]], rows: 32 },
  "2-4-2": { label: "2-4-2", hint: "Dos pasillos (A330, 767)", blocks: [["A", "C"], ["D", "E", "F", "G"], ["H", "K"]], rows: 40 },
  "3-3-3": { label: "3-3-3", hint: "Dos pasillos (787, A350)", blocks: [["A", "B", "C"], ["D", "E", "F"], ["G", "H", "J"]], rows: 45 },
  "3-4-3": { label: "3-4-3", hint: "Dos pasillos (777)", blocks: [["A", "B", "C"], ["D", "E", "F", "G"], ["H", "J", "K"]], rows: 50 },
};

/** Highest row the map draws, whatever is typed. */
export const MAX_SEAT_ROW = 99;

export function isSeatLayout(value: string | null | undefined): value is SeatLayout {
  return (SEAT_LAYOUTS as readonly string[]).includes(value ?? "");
}

/** "14A", " 14 a " → { row: 14, letter: "A" }; anything else (e.g. "coche 7") → null. */
export function parseSeat(seat: string | null | undefined): { row: number; letter: string } | null {
  const match = /^\s*(\d{1,3})\s*([a-z])\s*$/i.exec(seat ?? "");
  if (!match) return null;
  const row = Number(match[1]);
  if (row < 1 || row > MAX_SEAT_ROW) return null;
  return { row, letter: match[2].toUpperCase() };
}

export function seatLabel(row: number, letter: string) {
  return `${row}${letter}`;
}

/** Same seat, however it was typed ("14a" and "14A"). */
export function sameSeat(a: string | null | undefined, b: string | null | undefined) {
  const pa = parseSeat(a);
  const pb = parseSeat(b);
  return pa !== null && pb !== null && pa.row === pb.row && pa.letter === pb.letter;
}

/**
 * The layout to draw: the chosen one, else a guess from the letters already
 * saved (older flights have no layout). Single-aisle 3-3 is the default
 * because it is by far the most common cabin.
 */
export function resolveSeatLayout(chosen: string | null | undefined, seats: (string | null | undefined)[]): SeatLayout {
  if (isSeatLayout(chosen)) return chosen;
  const letters = new Set(seats.flatMap((s) => parseSeat(s)?.letter ?? []));
  if (letters.has("K")) return letters.has("B") || letters.has("J") ? "3-4-3" : "2-4-2";
  if (letters.has("G") || letters.has("H") || letters.has("J")) return "3-3-3";
  return "3-3";
}

/** Rows to draw for the whole cabin: the layout's size, or further back if a seat is. */
export function cabinRows(layout: SeatLayout, seats: (string | null | undefined)[]) {
  const furthest = Math.max(0, ...seats.map((s) => parseSeat(s)?.row ?? 0));
  return Math.max(SEAT_LAYOUT_META[layout].rows, furthest);
}

/**
 * The rows a compact map shows: each taken row and `pad` rows around it,
 * with "gap" where rows are skipped. Seats 3A and 30C → [2, 3, 4, "gap", 29, 30, 31].
 */
export function visibleRows(seatRows: number[], totalRows: number, pad = 1): (number | "gap")[] {
  const shown = new Set<number>();
  for (const row of seatRows) {
    for (let r = row - pad; r <= row + pad; r++) if (r >= 1 && r <= totalRows) shown.add(r);
  }
  const sorted = [...shown].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((row, i) => {
    if (i > 0 && row > sorted[i - 1] + 1) out.push("gap");
    out.push(row);
  });
  return out;
}

/** Window or aisle, for screen readers ("14A, ventana"). */
export function seatPosition(layout: SeatLayout, letter: string): "ventana" | "pasillo" | "en medio" | null {
  const blocks = SEAT_LAYOUT_META[layout].blocks;
  const b = blocks.findIndex((block) => block.includes(letter));
  if (b === -1) return null;
  const block = blocks[b];
  const i = block.indexOf(letter);
  if ((b === 0 && i === 0) || (b === blocks.length - 1 && i === block.length - 1)) return "ventana";
  if (i === 0 || i === block.length - 1) return "pasillo";
  return "en medio";
}
