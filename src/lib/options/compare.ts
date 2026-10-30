import { convert, toCents } from "@/lib/budget/money";
import { legMinutes } from "@/lib/transportations/legs";

/**
 * Comparing options (stays and legs saved before buying): which one is the
 * cheapest, the fastest, and which legs are alternatives for the same trip.
 * Pure functions.
 */

type Priced = { id: string; cost_amount: number | null; cost_currency: string | null };

/** Price in cents of the trip currency, or null without a price or an exchange rate. */
export function priceInTripCurrency(item: Priced, tripCurrency: string, rates: Map<string, number>) {
  if (item.cost_amount === null || !item.cost_currency) return null;
  return convert(toCents(Number(item.cost_amount)), item.cost_currency, tripCurrency, rates);
}

/**
 * The id of the cheapest option, only when there is something to compare: at
 * least two with a price we can convert, and a single lowest one.
 */
export function cheapestId(items: Priced[], tripCurrency: string, rates: Map<string, number>): string | null {
  const priced = items.flatMap((item) => {
    const cents = priceInTripCurrency(item, tripCurrency, rates);
    return cents === null ? [] : [{ id: item.id, cents }];
  });
  return uniqueMin(priced.map((p) => ({ id: p.id, value: p.cents })));
}

type Timed = { id: string; departs_at: string; arrives_at: string };

/** The id of the shortest leg among at least two, when there's a single shortest. */
export function fastestId(legs: (Timed & { departs_timezone: string; arrives_timezone: string })[]): string | null {
  return uniqueMin(legs.map((leg) => ({ id: leg.id, value: legMinutes(leg) })));
}

function uniqueMin(values: { id: string; value: number }[]): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values.map((v) => v.value));
  const lowest = values.filter((v) => v.value === min);
  return lowest.length === 1 ? lowest[0].id : null;
}

/** Cents per night, rounded; null for zero nights. */
export function perNight(cents: number, nights: number) {
  return nights > 0 ? Math.round(cents / nights) : null;
}

/** "Ciudad de México " and "ciudad de mexico" are the same place for grouping. */
function normalizePlace(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Legs between the same two places are alternatives for the same trip. */
export function routeKey(leg: { origin_name: string; destination_name: string }) {
  return `${normalizePlace(leg.origin_name)} → ${normalizePlace(leg.destination_name)}`;
}

/** Leg options grouped by route, groups in order of their earliest departure. */
export function groupByRoute<L extends { origin_name: string; destination_name: string; departs_at: string }>(legs: L[]) {
  const groups = new Map<string, L[]>();
  for (const leg of [...legs].sort((a, b) => a.departs_at.localeCompare(b.departs_at))) {
    const key = routeKey(leg);
    groups.set(key, [...(groups.get(key) ?? []), leg]);
  }
  return [...groups].map(([key, items]) => ({ key, legs: items }));
}
