/**
 * "Próxima actividad" in the trip overview: whatever comes first among the
 * activities, transport departures and hotel check-ins/check-outs that
 * haven't started yet. Transfers (metro, taxi…) are left out: they're the way
 * to the plan, not the plan. Pure, so it's easy to test with any "now".
 */

type Activity = { starts_at: string; timezone: string; category: string };
type Leg = { departs_at: string; departs_timezone: string };
type Stay = { check_in_at: string; check_out_at: string; timezone: string };

export type NextUp<A, L, S> =
  | { kind: "activity"; item: A; at: string; timezone: string }
  | { kind: "leg"; item: L; at: string; timezone: string }
  | { kind: "check_in" | "check_out"; item: S; at: string; timezone: string };

export function findNextUp<A extends Activity, L extends Leg, S extends Stay>(
  activities: A[],
  legs: L[],
  stays: S[],
  now: Date,
): NextUp<A, L, S> | undefined {
  const candidates: NextUp<A, L, S>[] = [
    ...activities
      .filter((a) => a.category !== "transfer")
      .map((a) => ({ kind: "activity" as const, item: a, at: a.starts_at, timezone: a.timezone })),
    ...legs.map((l) => ({ kind: "leg" as const, item: l, at: l.departs_at, timezone: l.departs_timezone })),
    ...stays.flatMap((s) => [
      { kind: "check_in" as const, item: s, at: s.check_in_at, timezone: s.timezone },
      { kind: "check_out" as const, item: s, at: s.check_out_at, timezone: s.timezone },
    ]),
  ];
  return candidates
    .filter((c) => Date.parse(c.at) > now.getTime())
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
}
