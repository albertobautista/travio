/**
 * Money in integer cents, so sums don't drift ("0.1 + 0.2"). Amounts come
 * from numeric(12,2) columns; rates from numeric(18,6).
 */

export const toCents = (amount: number) => Math.round(amount * 100);

/** Converts cents of `currency` into cents of the trip currency, or null when there's no rate. */
export function convert(cents: number, currency: string, tripCurrency: string, rates: Map<string, number>) {
  if (currency === tripCurrency) return cents;
  const rate = rates.get(currency);
  return rate ? Math.round(cents * rate) : null;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "$95,000" / "€42.50", in es-MX. Whole units when there are no cents. */
export function formatMoney(cents: number, currency: string) {
  const whole = cents % 100 === 0;
  const key = `${currency}-${whole}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}
