/** Currencies offered in forms. The database accepts any ISO 4217 code. */
export const CURRENCIES = [
  { code: "MXN", label: "Peso mexicano" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Libra esterlina" },
  { code: "CAD", label: "Dólar canadiense" },
  { code: "JPY", label: "Yen japonés" },
] as const;

export const DEFAULT_CURRENCY = "MXN";

export function isOfferedCurrency(code: string) {
  return CURRENCIES.some((c) => c.code === code);
}
