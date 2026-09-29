/** Small parsers shared by the activity and accommodation forms. Run on the server. */

export const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Only http(s) links: "javascript:" or "data:" URLs would run code when clicked. */
export function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "1,250.50", "1250,50" or "350" -> 1250.5 / 350. NaN if it isn't an amount. */
export function parseAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  return /^\d{1,10}(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}

export const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
