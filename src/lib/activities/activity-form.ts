import { isTime, parseAmount, parseHttpUrl, parseLocation, text } from "@/lib/form-fields";
import { isKnownTimeZone } from "@/lib/time-zones";
import { isOfferedCurrency } from "@/lib/trips/currencies";
import { formatTripDates } from "@/lib/trips/dates";
import { isIsoDate } from "@/lib/trips/trip-form";
import { isUuid } from "@/lib/uuid";
import { zonedTimeToInstant } from "@/lib/zoned-time";

import { isBookingStatus, isCategory, type ActivityCategory, type BookingStatus } from "./categories";

/**
 * Parsing and validation for the activity form. Runs on the server.
 * The user edits local wall time (date + "HH:MM") in the activity's city; we
 * turn it into an instant here, using the city's time zone from the database,
 * never one sent by the browser when a city is chosen.
 */

export type ActivityField =
  | "title"
  | "category"
  | "trip_stop_id"
  | "timezone"
  | "date"
  | "start_time"
  | "duration"
  | "location_name"
  | "address"
  | "booking_status"
  | "reservation_ref"
  | "cost_amount"
  | "cost_currency"
  | "external_url"
  | "notes"
  | "participants";

/** Raw form values (duration split in hours and minutes). */
export type ActivityFormValues = Record<Exclude<ActivityField, "duration" | "participants">, string> & {
  /** Hidden fields filled by the place search. */
  google_place_id: string;
  lat: string;
  lng: string;
  duration_hours: string;
  duration_minutes: string;
  /** Checked traveler ids. All of them checked means "everyone". */
  participants: string[];
};

export type ActivityFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<ActivityField, string>>;
      values?: ActivityFormValues;
    }
  | undefined;

export type ActivityData = {
  title: string;
  category: ActivityCategory;
  trip_stop_id: string | null;
  timezone: string;
  starts_at: string;
  duration_minutes: number;
  location_name: string | null;
  address: string | null;
  booking_status: BookingStatus;
  reservation_ref: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  external_url: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
};

type Context = {
  trip: { start_date: string | null; end_date: string | null; currency: string };
  /** The trip's stops, to resolve the chosen city's time zone. */
  stops: { id: string; timezone: string }[];
  /** The trip's traveler ids, to validate participants. */
  travelerIds: string[];
};

const MAX_DURATION = 7 * 24 * 60;

export function parseActivityForm(
  formData: FormData,
  { trip, stops, travelerIds }: Context,
):
  | { ok: true; data: ActivityData; participantIds: string[]; savedPlaceId: string | null; values: ActivityFormValues }
  | { ok: false; fieldErrors: Partial<Record<ActivityField, string>>; values: ActivityFormValues } {
  const values: ActivityFormValues = {
    participants: formData.getAll("participants").map(String),
    title: text(formData, "title"),
    category: text(formData, "category") || "other",
    trip_stop_id: text(formData, "trip_stop_id"),
    timezone: text(formData, "timezone"),
    date: text(formData, "date"),
    start_time: text(formData, "start_time"),
    duration_hours: text(formData, "duration_hours"),
    duration_minutes: text(formData, "duration_minutes"),
    location_name: text(formData, "location_name"),
    address: text(formData, "address"),
    booking_status: text(formData, "booking_status") || "planned",
    reservation_ref: text(formData, "reservation_ref"),
    cost_amount: text(formData, "cost_amount"),
    cost_currency: text(formData, "cost_currency") || trip.currency,
    external_url: text(formData, "external_url"),
    notes: text(formData, "notes"),
    google_place_id: text(formData, "google_place_id"),
    lat: text(formData, "lat"),
    lng: text(formData, "lng"),
  };

  const errors: Partial<Record<ActivityField, string>> = {};

  if (!values.title) errors.title = "Ponle un nombre a la actividad.";
  else if (values.title.length > 160) errors.title = "Máximo 160 caracteres.";

  if (!isCategory(values.category)) errors.category = "Elige una categoría de la lista.";
  if (!isBookingStatus(values.booking_status)) errors.booking_status = "Elige un estado de la lista.";

  // Time zone: from the chosen city, or typed when there's no city.
  let timezone: string | null = null;
  if (values.trip_stop_id) {
    const stop = isUuid(values.trip_stop_id) ? stops.find((s) => s.id === values.trip_stop_id) : undefined;
    if (stop) timezone = stop.timezone;
    else errors.trip_stop_id = "Elige una ciudad de este viaje.";
  } else if (!values.timezone) {
    errors.timezone = "Elige la zona horaria (o una ciudad del viaje).";
  } else if (!isKnownTimeZone(values.timezone)) {
    errors.timezone = "Elige una zona de la lista: busca la ciudad, por ejemplo “Miami”.";
  } else {
    timezone = values.timezone;
  }

  if (!values.date) errors.date = "Elige el día.";
  else if (!isIsoDate(values.date)) errors.date = "Fecha no válida.";
  else if (trip.start_date && trip.end_date && (values.date < trip.start_date || values.date > trip.end_date)) {
    errors.date = `Debe estar dentro del viaje (${formatTripDates(trip.start_date, trip.end_date)}).`;
  }

  if (!isTime(values.start_time)) errors.start_time = "Elige la hora de inicio.";

  const hours = values.duration_hours ? Number(values.duration_hours) : 0;
  const minutes = values.duration_minutes ? Number(values.duration_minutes) : 0;
  const duration = hours * 60 + minutes;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    errors.duration = "Usa horas enteras y de 0 a 59 minutos.";
  } else if (duration <= 0) {
    errors.duration = "¿Cuánto dura? Al menos 1 minuto.";
  } else if (duration > MAX_DURATION) {
    errors.duration = "Máximo 7 días.";
  }

  if (values.location_name.length > 200) errors.location_name = "Máximo 200 caracteres.";
  const location = parseLocation(formData);
  if (!location) errors.location_name = "La ubicación elegida no es válida. Búscala de nuevo.";
  if (values.address.length > 300) errors.address = "Máximo 300 caracteres.";
  if (values.reservation_ref.length > 120) errors.reservation_ref = "Máximo 120 caracteres.";
  if (values.notes.length > 2000) errors.notes = "Máximo 2000 caracteres.";

  let cost: number | null = null;
  if (values.cost_amount) {
    // Accept "1,250.50" and "1250,50" style input.
    cost = parseAmount(values.cost_amount);
    if (Number.isNaN(cost)) errors.cost_amount = "Escribe un monto, por ejemplo 350 o 1250.50.";
  }
  if (cost !== null && !isOfferedCurrency(values.cost_currency)) errors.cost_currency = "Elige una moneda de la lista.";

  let url: string | null = null;
  if (values.external_url) {
    url = parseHttpUrl(values.external_url);
    if (!url) errors.external_url = "Escribe un enlace que empiece con https://";
    else if (url.length > 2000) errors.external_url = "El enlace es demasiado largo.";
  }

  // Every traveler checked is saved as "everyone" (no rows) by the database
  // function set_activity_participants. None checked is a mistake, not
  // "everyone", so we ask.
  const participantIds = [...new Set(values.participants)];
  if (participantIds.some((id) => !travelerIds.includes(id))) {
    errors.participants = "Elige personas de este viaje.";
  } else if (travelerIds.length > 0 && participantIds.length === 0) {
    errors.participants = "Elige al menos a una persona.";
  }

  if (Object.keys(errors).length > 0 || !timezone) {
    return { ok: false, fieldErrors: errors, values };
  }

  // Set when scheduling a saved place. Only used on create; the database checks
  // it's a saved place of the same trip (composite foreign key).
  const savedPlaceId = text(formData, "saved_place_id");

  return {
    ok: true,
    values,
    participantIds,
    savedPlaceId: isUuid(savedPlaceId) ? savedPlaceId : null,
    data: {
      title: values.title,
      category: values.category as ActivityCategory,
      trip_stop_id: values.trip_stop_id || null,
      timezone,
      starts_at: zonedTimeToInstant(values.date, values.start_time, timezone).toISOString(),
      duration_minutes: duration,
      location_name: values.location_name || null,
      address: values.address || null,
      booking_status: values.booking_status as BookingStatus,
      reservation_ref: values.reservation_ref || null,
      cost_amount: cost,
      cost_currency: cost !== null ? values.cost_currency : null,
      external_url: url,
      notes: values.notes || null,
      ...location!,
    },
  };
}
