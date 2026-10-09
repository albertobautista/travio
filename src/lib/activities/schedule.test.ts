import { describe, expect, it } from "vitest";

import { findConflicts, formatDuration, formatTimeRange, getEnd, type Schedulable } from "./schedule";

const at = (iso: string) => new Date(iso);
const act = (id: string, start: string, minutes: number, participantIds?: string[]): Schedulable => ({
  id,
  title: id,
  startsAt: at(start),
  durationMinutes: minutes,
  participantIds,
});

describe("getEnd", () => {
  it("adds the duration to the start", () => {
    expect(getEnd(at("2026-10-03T10:00:00Z"), 90).toISOString()).toBe("2026-10-03T11:30:00.000Z");
  });
});

describe("findConflicts", () => {
  it("reports an overlap on both activities, with its length", () => {
    // The CLAUDE.md example: museum 10:00–12:00, guided tour 11:30–14:00.
    const conflicts = findConflicts([act("museo", "2026-10-03T10:00:00Z", 120), act("tour", "2026-10-03T11:30:00Z", 150)]);
    expect(conflicts.get("museo")).toEqual([{ id: "tour", title: "tour", overlapMinutes: 30 }]);
    expect(conflicts.get("tour")).toEqual([{ id: "museo", title: "museo", overlapMinutes: 30 }]);
  });

  it("doesn't count back-to-back activities", () => {
    const conflicts = findConflicts([act("a", "2026-10-03T10:00:00Z", 60), act("b", "2026-10-03T11:00:00Z", 60)]);
    expect(conflicts.size).toBe(0);
  });

  it("ignores overlaps between people who aren't together", () => {
    const conflicts = findConflicts([act("a", "2026-10-03T10:00:00Z", 120, ["ana"]), act("b", "2026-10-03T10:30:00Z", 60, ["leo"])]);
    expect(conflicts.size).toBe(0);
  });

  it("treats no participants as everyone", () => {
    const conflicts = findConflicts([act("a", "2026-10-03T10:00:00Z", 120), act("b", "2026-10-03T10:30:00Z", 60, ["leo"])]);
    expect(conflicts.get("a")?.[0].overlapMinutes).toBe(60);
  });

  it("finds an activity overlapping several, whatever the input order", () => {
    const conflicts = findConflicts([
      act("c", "2026-10-03T11:00:00Z", 30),
      act("a", "2026-10-03T09:00:00Z", 240),
      act("b", "2026-10-03T10:00:00Z", 30),
    ]);
    expect(conflicts.get("a")?.map((c) => c.id).sort()).toEqual(["b", "c"]);
    expect(conflicts.has("b") && conflicts.has("c")).toBe(true);
    expect(conflicts.get("b")?.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30"],
    [125, "2 h 05"],
    [1560, "1 d 2 h"],
  ])("%i minutes -> %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("formatTimeRange", () => {
  it("shows the times in the activity's time zone", () => {
    expect(formatTimeRange(at("2026-10-03T08:00:00Z"), 90, "Europe/Madrid")).toBe("10:00 – 11:30");
  });

  it("marks an end on a later local day", () => {
    expect(formatTimeRange(at("2026-10-03T19:30:00Z"), 18 * 60, "Europe/Madrid")).toBe("21:30 – 15:30 (+1)");
  });
});
