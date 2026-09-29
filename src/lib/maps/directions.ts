/**
 * Google Maps directions link (opens the app on phones; no API key needed).
 *
 * With coordinates and a place id it points at the exact place; otherwise it
 * searches the name and address as text. Only a real place counts: without a
 * name or address there's nowhere to go, so it returns null.
 */
export function directionsUrl(place: {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  google_place_id?: string | null;
}) {
  const params = new URLSearchParams({ api: "1" });
  if (place.lat != null && place.lng != null) {
    params.set("destination", `${place.lat},${place.lng}`);
    if (place.google_place_id) params.set("destination_place_id", place.google_place_id);
  } else {
    const text = [place.name, place.address].filter(Boolean).join(", ");
    if (!text) return null;
    params.set("destination", text);
  }
  return `https://www.google.com/maps/dir/?${params}`;
}
