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

/**
 * The hidden place fields set by the place search (PlaceFields). They come from
 * the browser, so they're validated like any input: both coordinates or none,
 * within range, and a plausible Google place id. Returns null if malformed.
 */
export function parseLocation(formData: FormData) {
  const placeId = text(formData, "google_place_id");
  const latText = text(formData, "lat");
  const lngText = text(formData, "lng");
  if (!latText && !lngText) return { google_place_id: null, lat: null, lng: null };
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!latText || !lngText || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  if (placeId && !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
  return { google_place_id: placeId || null, lat, lng };
}
