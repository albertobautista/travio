import { parseLocation } from "@/lib/form-fields";
import { isKnownTimeZone } from "@/lib/time-zones";

import { formatTripDates } from "./dates";
import { isIsoDate } from "./trip-form";

/** Parsing and validation for the stop (city) form. Runs on the server. */

export type StopField = "name" | "arrives_on" | "departs_on" | "timezone" | "notes";
/** Plus the place picked in the city search (hidden fields). */
export type StopFormValues = Record<StopField | "google_place_id" | "lat" | "lng", string>;

export type StopFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<StopField, string>>;
      values?: StopFormValues;
    }
  | undefined;

export type StopFormData = {
  name: string;
  arrives_on: string | null;
  departs_on: string | null;
  timezone: string;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
};

type TripDates = { start_date: string | null; end_date: string | null };

const MAX_NAME = 120;
const MAX_NOTES = 2000;

export function parseStopForm(
  formData: FormData,
  trip: TripDates,
):
  | { ok: true; data: StopFormData; values: StopFormValues }
  | { ok: false; fieldErrors: Partial<Record<StopField, string>>; values: StopFormValues } {
  const values: StopFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    arrives_on: String(formData.get("arrives_on") ?? ""),
    departs_on: String(formData.get("departs_on") ?? ""),
    timezone: String(formData.get("timezone") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    google_place_id: String(formData.get("google_place_id") ?? "").trim(),
    lat: String(formData.get("lat") ?? "").trim(),
    lng: String(formData.get("lng") ?? "").trim(),
  };

  const fieldErrors: Partial<Record<StopField, string>> = {};

  if (!values.name) fieldErrors.name = "Escribe el nombre de la ciudad.";
  else if (values.name.length > MAX_NAME) fieldErrors.name = `Máximo ${MAX_NAME} caracteres.`;

  if (!values.timezone) fieldErrors.timezone = "Elige la zona horaria de la ciudad.";
  else if (!isKnownTimeZone(values.timezone)) {
    fieldErrors.timezone = "Elige una zona de la lista: busca la ciudad, por ejemplo “Miami”.";
  }

  if (values.arrives_on && !isIsoDate(values.arrives_on)) fieldErrors.arrives_on = "Fecha no válida.";
  if (values.departs_on && !isIsoDate(values.departs_on)) fieldErrors.departs_on = "Fecha no válida.";
  if (!fieldErrors.arrives_on && !fieldErrors.departs_on && values.arrives_on && values.departs_on) {
    if (values.departs_on < values.arrives_on) {
      fieldErrors.departs_on = "La salida no puede ser antes de la llegada.";
    }
  }

  // Stops must fall inside the trip, when the trip has dates.
  if (trip.start_date && trip.end_date) {
    const range = formatTripDates(trip.start_date, trip.end_date);
    for (const field of ["arrives_on", "departs_on"] as const) {
      const value = values[field];
      if (value && !fieldErrors[field] && (value < trip.start_date || value > trip.end_date)) {
        fieldErrors[field] = `Debe estar dentro del viaje (${range}).`;
      }
    }
  }

  // The city's place comes from the browser: a bad one is dropped, not an error to show.
  const location = parseLocation(formData) ?? { google_place_id: null, lat: null, lng: null };

  if (values.notes.length > MAX_NOTES) fieldErrors.notes = `Máximo ${MAX_NOTES} caracteres.`;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return {
    ok: true,
    values,
    data: {
      name: values.name,
      arrives_on: values.arrives_on || null,
      departs_on: values.departs_on || null,
      timezone: values.timezone,
      notes: values.notes || null,
      ...location,
    },
  };
}
