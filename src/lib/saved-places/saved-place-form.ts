import { isCategory, type ActivityCategory } from "@/lib/activities/categories";
import { parseHttpUrl, parseLocation, text } from "@/lib/form-fields";
import { isUuid } from "@/lib/uuid";

/** Parsing and validation for the saved place form. Runs on the server. */

export type SavedPlaceField = "name" | "address" | "trip_stop_id" | "category" | "estimated_minutes" | "external_url" | "notes";

export type SavedPlaceFormValues = Record<SavedPlaceField, string> & {
  /** Hidden fields filled by the place search. */
  google_place_id: string;
  lat: string;
  lng: string;
};

export type SavedPlaceFormState =
  | { error?: string; fieldErrors?: Partial<Record<SavedPlaceField, string>>; values?: SavedPlaceFormValues }
  | undefined;

export type SavedPlaceData = {
  name: string;
  address: string | null;
  trip_stop_id: string | null;
  category: ActivityCategory;
  estimated_minutes: number | null;
  external_url: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
};

/** "Aprox." presets offered in the form (minutes). */
export const ESTIMATE_PRESETS = [30, 60, 90, 120, 180, 240] as const;

export function parseSavedPlaceForm(
  formData: FormData,
  { stopIds }: { stopIds: string[] },
):
  | { ok: true; data: SavedPlaceData; values: SavedPlaceFormValues }
  | { ok: false; fieldErrors: Partial<Record<SavedPlaceField, string>>; values: SavedPlaceFormValues } {
  const values: SavedPlaceFormValues = {
    name: text(formData, "name"),
    address: text(formData, "address"),
    trip_stop_id: text(formData, "trip_stop_id"),
    category: text(formData, "category") || "sightseeing",
    estimated_minutes: text(formData, "estimated_minutes"),
    external_url: text(formData, "external_url"),
    notes: text(formData, "notes"),
    google_place_id: text(formData, "google_place_id"),
    lat: text(formData, "lat"),
    lng: text(formData, "lng"),
  };
  const errors: Partial<Record<SavedPlaceField, string>> = {};

  if (!values.name) errors.name = "¿Qué lugar es? Escribe el nombre o búscalo.";
  else if (values.name.length > 200) errors.name = "Máximo 200 caracteres.";
  if (values.address.length > 300) errors.address = "Máximo 300 caracteres.";

  if (values.trip_stop_id && !(isUuid(values.trip_stop_id) && stopIds.includes(values.trip_stop_id))) {
    errors.trip_stop_id = "Elige una ciudad de este viaje.";
  }
  if (!isCategory(values.category)) errors.category = "Elige una categoría de la lista.";

  let minutes: number | null = null;
  if (values.estimated_minutes) {
    minutes = Number(values.estimated_minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) errors.estimated_minutes = "Elige un tiempo de la lista.";
  }

  let url: string | null = null;
  if (values.external_url) {
    url = parseHttpUrl(values.external_url);
    if (!url) errors.external_url = "Escribe un enlace que empiece con https://";
    else if (url.length > 2000) errors.external_url = "El enlace es demasiado largo.";
  }
  if (values.notes.length > 2000) errors.notes = "Máximo 2000 caracteres.";

  const location = parseLocation(formData);
  if (!location) errors.address = "La ubicación elegida no es válida. Búscala de nuevo.";

  if (Object.keys(errors).length > 0 || !location) return { ok: false, fieldErrors: errors, values };

  return {
    ok: true,
    values,
    data: {
      name: values.name,
      address: values.address || null,
      trip_stop_id: values.trip_stop_id || null,
      category: values.category as ActivityCategory,
      estimated_minutes: minutes,
      external_url: url,
      notes: values.notes || null,
      ...location,
    },
  };
}
