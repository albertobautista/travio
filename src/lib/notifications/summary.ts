import { formatLocalMoment } from "@/lib/zoned-time";

import type { ChangesFrequency } from "./options";

/**
 * Turning raw trip_events into the lines of a summary email. Pure (no
 * database, no clock), so it's easy to test.
 */

export type TripEvent = {
  trip_id: string;
  actor_id: string;
  entity: "activity" | "stay" | "leg" | "file";
  entity_id: string;
  action: "created" | "updated" | "deleted";
  detail: { title?: string; starts_at?: string; old_starts_at?: string; timezone?: string };
  created_at: string;
};

const NOUN: Record<Exclude<TripEvent["entity"], "file">, string> = {
  activity: "",
  stay: "el hospedaje ",
  leg: "el trayecto ",
};

/** Max lines per trip; the rest become "y N cambios más". */
export const MAX_LINES_PER_TRIP = 15;

/**
 * One line per thing that changed, oldest first. Several edits to the same
 * activity are one line (its final state); something created and deleted in
 * the same window isn't mentioned; uploads are counted per person.
 */
export function summarizeTrip(events: TripEvent[], nameOf: (userId: string) => string): string[] {
  const byEntity = new Map<string, TripEvent[]>();
  const uploads = new Map<string, number>();
  for (const e of events) {
    if (e.entity === "file") {
      if (e.action === "created") uploads.set(e.actor_id, (uploads.get(e.actor_id) ?? 0) + 1);
      continue; // deleting a document isn't news
    }
    byEntity.set(e.entity_id, [...(byEntity.get(e.entity_id) ?? []), e]);
  }

  const lines: { at: string; text: string }[] = [];
  for (const list of byEntity.values()) {
    const first = list[0];
    const last = list[list.length - 1];
    const created = list.some((e) => e.action === "created");
    const deleted = last.action === "deleted";
    if (created && deleted) continue;

    const who = nameOf(last.actor_id);
    const what = `${NOUN[last.entity as keyof typeof NOUN]}«${last.detail.title ?? "sin nombre"}»`;
    const when = last.detail.starts_at && last.detail.timezone ? formatLocalMoment(last.detail.starts_at, last.detail.timezone) : null;

    let text: string;
    if (deleted) text = `${who} eliminó ${what}`;
    else if (created) text = `${who} agregó ${what}${when ? ` · ${when}` : ""}`;
    else {
      // The time moved if any edit moved it: compare the first old time with the final one.
      const from = list.find((e) => e.detail.old_starts_at)?.detail.old_starts_at;
      if (from && last.detail.starts_at && from !== last.detail.starts_at && last.detail.timezone) {
        text = `${who} cambió la hora de ${what}: ${formatLocalMoment(from, last.detail.timezone)} → ${formatLocalMoment(last.detail.starts_at, last.detail.timezone)}`;
      } else {
        text = `${who} editó ${what}${when ? ` · ${when}` : ""}`;
      }
    }
    lines.push({ at: first.created_at, text });
  }
  for (const [actor, count] of uploads) {
    const at = events.find((e) => e.entity === "file" && e.actor_id === actor)!.created_at;
    lines.push({ at, text: `${nameOf(actor)} subió ${count === 1 ? "1 documento" : `${count} documentos`}` });
  }
  return lines.sort((a, b) => a.at.localeCompare(b.at)).map((l) => l.text);
}

const HOUR = 60 * 60_000;

/**
 * Is a summary due for this person now? Hourly: an hour since the last one.
 * Daily: about a day since the last one, and not before 8:00 at home
 * (`homeHour`, so it lands in the morning, not at 3 a.m.).
 */
export function summaryDue(frequency: ChangesFrequency, lastSent: Date | null, now: Date, homeHour: number) {
  if (frequency === "off") return false;
  const since = lastSent ? now.getTime() - lastSent.getTime() : Infinity;
  if (frequency === "hourly") return since >= HOUR - 5 * 60_000; // the clock ticks every 10 min
  return since >= 20 * HOUR && homeHour >= 8;
}
