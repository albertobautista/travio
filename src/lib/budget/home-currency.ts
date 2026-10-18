import { DEFAULT_CURRENCY, isOfferedCurrency } from "@/lib/trips/currencies";

/**
 * "Tu moneda": the currency someone thinks in back home. When a trip is in
 * another currency (a USD trip for someone from Mexico), the budget also
 * shows its totals in this one. A setting of the person, not of the trip,
 * kept in a cookie on this device like the theme; "none" turns it off.
 */

export const HOME_CURRENCY_COOKIE = "home_currency";

/** The saved choice: a currency code, or null when turned off. MXN when unset. */
export function parseHomeCurrency(value: string | undefined): string | null {
  if (value === "none") return null;
  return value && isOfferedCurrency(value) ? value : DEFAULT_CURRENCY;
}

/**
 * Cents of the trip currency in the home currency. `rate` is how the trip
 * stores it: 1 unit of the home currency = `rate` units of the trip's.
 */
export function toHomeCurrency(tripCents: number, rate: number) {
  return Math.round(tripCents / rate);
}
