import { DEFAULT_CURRENCY, isOfferedCurrency } from "./currencies";

/**
 * Parsing and validation for the trip form, shared by "create" and "edit".
 * Runs on the server: anyone can call a Server Action with arbitrary data,
 * so browser-side checks are only a convenience.
 */

export type TripField = "name" | "start_date" | "end_date" | "currency" | "description";
export type TripFormValues = Record<TripField, string>;

export type TripFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<TripField, string>>;
      // React resets a form after its action runs; we send the values back so
      // the user doesn't lose what they typed when validation fails.
      values?: TripFormValues;
    }
  | undefined;

/** Columns written to `trips` from the form. */
export type TripFormData = {
  name: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  description: string | null;
};

const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates like 2026-02-30, which Date would roll over.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseTripForm(
  formData: FormData,
):
  | { ok: true; data: TripFormData; values: TripFormValues }
  | { ok: false; fieldErrors: Partial<Record<TripField, string>>; values: TripFormValues } {
  const values: TripFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    start_date: String(formData.get("start_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    currency: String(formData.get("currency") ?? DEFAULT_CURRENCY),
    description: String(formData.get("description") ?? "").trim(),
  };

  const fieldErrors: Partial<Record<TripField, string>> = {};

  if (!values.name) fieldErrors.name = "Ponle un nombre a tu viaje.";
  else if (values.name.length > MAX_NAME) fieldErrors.name = `Máximo ${MAX_NAME} caracteres.`;

  if (values.start_date && !isIsoDate(values.start_date)) fieldErrors.start_date = "Fecha no válida.";
  if (values.end_date && !isIsoDate(values.end_date)) fieldErrors.end_date = "Fecha no válida.";
  if (values.end_date && !values.start_date) {
    fieldErrors.start_date = "Agrega también la fecha de inicio.";
  }
  if (!fieldErrors.start_date && !fieldErrors.end_date && values.end_date && values.end_date < values.start_date) {
    fieldErrors.end_date = "El regreso no puede ser antes de la salida.";
  }

  if (!isOfferedCurrency(values.currency)) fieldErrors.currency = "Elige una moneda de la lista.";
  if (values.description.length > MAX_DESCRIPTION) {
    fieldErrors.description = `Máximo ${MAX_DESCRIPTION} caracteres.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return {
    ok: true,
    values,
    data: {
      name: values.name,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      currency: values.currency,
      description: values.description || null,
    },
  };
}
