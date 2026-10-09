import { describe, expect, it } from "vitest";

import { summarizeTrip, summaryDue, type TripEvent } from "./summary";

const names: Record<string, string> = { ana: "Ana", leo: "Leo" };
const nameOf = (id: string) => names[id] ?? "Alguien";
let clock = 0;
const event = (e: Partial<TripEvent> & Pick<TripEvent, "entity_id" | "action">): TripEvent => ({
  trip_id: "trip",
  actor_id: "ana",
  entity: "activity",
  detail: {},
  created_at: new Date(Date.UTC(2026, 9, 5, 10, clock++)).toISOString(),
  ...e,
});

describe("summarizeTrip", () => {
  it("one line per thing, however many edits it had", () => {
    const lines = summarizeTrip(
      [
        event({ entity_id: "cena", action: "updated", detail: { title: "Cena" } }),
        event({ entity_id: "cena", action: "updated", detail: { title: "Cena en Casa Lucio" } }),
      ],
      nameOf,
    );
    expect(lines).toEqual(["Ana editó «Cena en Casa Lucio»"]);
  });

  it("shows a time change from the first old time to the final one", () => {
    const tz = "Europe/Madrid";
    const lines = summarizeTrip(
      [
        event({ entity_id: "c", action: "updated", detail: { title: "Catedral", timezone: tz, starts_at: "2026-10-06T08:30:00Z", old_starts_at: "2026-10-06T08:00:00Z" } }),
        event({ entity_id: "c", action: "updated", detail: { title: "Catedral", timezone: tz, starts_at: "2026-10-06T09:00:00Z", old_starts_at: "2026-10-06T08:30:00Z" } }),
      ],
      nameOf,
    );
    expect(lines).toEqual(["Ana cambió la hora de «Catedral»: mar 6 oct · 10:00 → mar 6 oct · 11:00"]);
  });

  it("skips what was created and deleted in the same window", () => {
    const lines = summarizeTrip(
      [event({ entity_id: "x", action: "created", detail: { title: "Prueba" } }), event({ entity_id: "x", action: "deleted", detail: { title: "Prueba" } })],
      nameOf,
    );
    expect(lines).toEqual([]);
  });

  it("counts uploads per person and names stays", () => {
    const lines = summarizeTrip(
      [
        event({ entity: "file", entity_id: "f1", action: "created", actor_id: "leo", detail: { title: "a.pdf" } }),
        event({ entity: "file", entity_id: "f2", action: "created", actor_id: "leo", detail: { title: "b.pdf" } }),
        event({ entity: "stay", entity_id: "h", action: "deleted", detail: { title: "Hotel Casa 1800" } }),
      ],
      nameOf,
    );
    expect(lines).toEqual(["Leo subió 2 documentos", "Ana eliminó el hospedaje «Hotel Casa 1800»"]);
  });
});

describe("summaryDue", () => {
  const now = new Date("2026-10-06T15:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  it("hourly: about an hour after the last one", () => {
    expect(summaryDue("hourly", hoursAgo(1), now, 9)).toBe(true);
    expect(summaryDue("hourly", hoursAgo(0.5), now, 9)).toBe(false);
  });

  it("daily: a day later, and not before 8:00 at home", () => {
    expect(summaryDue("daily", hoursAgo(24), now, 9)).toBe(true);
    expect(summaryDue("daily", hoursAgo(24), now, 6)).toBe(false);
    expect(summaryDue("daily", hoursAgo(5), now, 9)).toBe(false);
    expect(summaryDue("daily", null, now, 9)).toBe(true);
  });

  it("off: never", () => {
    expect(summaryDue("off", null, now, 9)).toBe(false);
  });
});
