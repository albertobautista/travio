import "server-only";

/**
 * Today's reference rates from the European Central Bank, via Frankfurter
 * (https://frankfurter.dev, free, no key). Only a suggestion: the trip keeps
 * the rate the user confirms, so totals never move by themselves.
 * Cached 12 h (the ECB publishes once per working day).
 */
export async function suggestRates(currencies: string[], tripCurrency: string) {
  const out = new Map<string, { rate: number; date: string }>();
  await Promise.all(
    currencies.map(async (from) => {
      try {
        const res = await fetch(
          `https://api.frankfurter.dev/v1/latest?${new URLSearchParams({ base: from, symbols: tripCurrency })}`,
          { next: { revalidate: 12 * 60 * 60 } },
        );
        if (!res.ok) return; // e.g. a currency the ECB doesn't publish
        const data = (await res.json()) as { date: string; rates: Record<string, number> };
        const rate = data.rates[tripCurrency];
        if (rate) out.set(from, { rate, date: data.date });
      } catch (e) {
        console.error("ECB rate lookup failed", from, e);
      }
    }),
  );
  return out;
}
