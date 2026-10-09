import { describe, expect, it } from "vitest";

import { buildDayPlan, forTraveler, formatStartsIn, type PlanActivity } from "./day-plan";

const plan = (id: string, start: string, minutes: number, category = "sightseeing"): PlanActivity => ({
  id,
  title: id,
  startsAt: new Date(start),
  durationMinutes: minutes,
  participantIds: [],
  category,
});

// A day in Madrid, in UTC: 15:30 Reina Sofía (2 h), 17:35 metro (25 min), 18:05 Debod (55 min).
const day = [
  plan("paseo", "2026-10-03T14:05:00Z", 55),
  plan("museo", "2026-10-03T15:30:00Z", 120),
  plan("metro", "2026-10-03T17:35:00Z", 25, "transfer"),
  plan("debod", "2026-10-03T18:05:00Z", 55),
];

describe("buildDayPlan", () => {
  it("marks what's done, what's happening now and what's next", () => {
    const { items, current, next, focus } = buildDayPlan(day, new Date("2026-10-03T16:18:00Z"));
    const state = Object.fromEntries(items.filter((i) => i.kind === "activity").map((i) => [i.activity.id, i.state]));
    expect(state).toEqual({ paseo: "done", museo: "now", metro: "upcoming", debod: "upcoming" });
    expect(current.map((a) => a.id)).toEqual(["museo"]);
    // The metro is a transfer: "next" is the temple it takes you to.
    expect(next.map((a) => a.id)).toEqual(["debod"]);
    expect(focus.map((a) => a.id)).toEqual(["museo"]);
  });

  it("puts the next plan in focus when nothing is happening", () => {
    const { focus } = buildDayPlan(day, new Date("2026-10-03T12:00:00Z"));
    expect(focus.map((a) => a.id)).toEqual(["paseo"]);
  });

  it("while on a transfer, focuses on where you're going", () => {
    const { current, focus } = buildDayPlan(day, new Date("2026-10-03T17:40:00Z"));
    expect(current.map((a) => a.id)).toEqual(["metro"]);
    expect(focus.map((a) => a.id)).toEqual(["debod"]);
  });

  it("lists gaps of 30 minutes or more as free time", () => {
    const { items } = buildDayPlan(day, new Date("2026-10-03T12:00:00Z"));
    const free = items.filter((i) => i.kind === "free");
    // 15:00–15:30 is a 30 min gap; museum → metro is 5 min and metro → temple 5 min.
    expect(free).toHaveLength(1);
    expect(free[0]).toMatchObject({ minutes: 30 });
  });

  it("nothing in focus once the day is over", () => {
    expect(buildDayPlan(day, new Date("2026-10-03T23:00:00Z")).focus).toEqual([]);
  });
});

describe("forTraveler", () => {
  const list = [{ id: "all", participantIds: [] }, { id: "ana", participantIds: ["ana"] }, { id: "leo", participantIds: ["leo"] }];

  it("keeps what's for everyone plus what lists that traveler", () => {
    expect(forTraveler(list, "ana").map((a) => a.id)).toEqual(["all", "ana"]);
  });

  it("without a traveler, keeps everything", () => {
    expect(forTraveler(list, null)).toHaveLength(3);
  });
});

describe("formatStartsIn", () => {
  const now = new Date("2026-10-03T16:00:00Z");
  it.each([
    ["2026-10-03T16:25:00Z", "en 25 min"],
    ["2026-10-03T17:05:00Z", "en 1 h 05 min"],
    ["2026-10-03T18:00:00Z", "en 2 h"],
    ["2026-10-03T15:59:00Z", "ahora"],
  ])("%s -> %s", (start, expected) => {
    expect(formatStartsIn(new Date(start), now)).toBe(expected);
  });
});
