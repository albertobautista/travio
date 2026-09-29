/**
 * Loads the Google Maps JavaScript API once per page, in the browser only.
 *
 * Uses Google's recommended dynamic loading: a single <script> with
 * `loading=async`, then `google.maps.importLibrary("maps" | "marker" |
 * "places")` pulls in only the libraries a component needs.
 *
 * The key is public by nature (it's in the browser); it's protected by the
 * HTTP-referrer and API restrictions set in Google Cloud, not by secrecy.
 */

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export const mapsConfigured = () => MAPS_API_KEY.length > 0;

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps only loads in the browser"));
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const callback = "__travioMapsReady";
      (window as unknown as Record<string, () => void>)[callback] = () => resolve();
      const params = new URLSearchParams({
        key: MAPS_API_KEY,
        v: "weekly",
        loading: "async",
        language: "es",
        callback,
      });
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.onerror = () => {
        loading = null; // allow a retry
        reject(new Error("No se pudo cargar Google Maps"));
      };
      document.head.append(script);
    });
  }
  return loading;
}

export async function importMapsLibrary<K extends "maps" | "marker" | "places" | "core">(name: K) {
  if (!mapsConfigured()) throw new Error("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
  await loadScript();
  return google.maps.importLibrary(name) as Promise<
    K extends "maps"
      ? google.maps.MapsLibrary
      : K extends "marker"
        ? google.maps.MarkerLibrary
        : K extends "places"
          ? google.maps.PlacesLibrary
          : google.maps.CoreLibrary
  >;
}
