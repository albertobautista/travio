import { isBookingStatus, type BookingStatus } from "@/lib/activities/categories";
import { isTime, parseAmount, parseHttpUrl, parseLocation, text } from "@/lib/form-fields";
import { isKnownTimeZone } from "@/lib/time-zones";
import { isOfferedCurrency } from "@/lib/trips/currencies";
import { formatTripDates } from "@/lib/trips/dates";
import { isIsoDate } from "@/lib/trips/trip-form";
import { isUuid } from "@/lib/uuid";
import { zonedTimeToInstant } from "@/lib/zoned-time";

/**
 * Parsing and validation for the accommodation form. Runs on the server.
 * Like activities, check-in and check-out are edited as local wall time in the
 * stay's city and turned into instants here, with the city's time zone from
 * the database (never one sent by the browser when a city is chosen).
 */

export type AccommodationField =
  | "name"
  | "trip_stop_id"
  | "timezone"
  | "check_in_date"
  | "check_in_time"
  | "check_out_date"
  | "check_out_time"
  | "address"
  | "booking_status"
  | "booking_ref"
  | "booking_url"
  | "cost_amount"
  | "cost_currency"
  | "notes"
  | "participants";

export type AccommodationFormValues = Record<Exclude<AccommodationField, "participants">, string> & {
  /** Hidden fields filled by the place search. */
  google_place_id: string;
  lat: string;
  lng: string;
  /** Checked traveler ids. All of them checked means "everyone". */
  participants: string[];
};

export type AccommodationFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<AccommodationField, string>>;
      values?: AccommodationFormValues;
    }
  | undefined;

export type AccommodationData = {
  name: string;
  trip_stop_id: string | null;
  timezone: string;
  check_in_at: string;
  check_out_at: string;
  address: string | null;
  booking_status: BookingStatus;
  booking_ref: string | null;
  booking_url: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  notes: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
};

type Context = {
  trip: { start_date: string | null; end_date: string | null; currency: string };
  stops: { id: string; timezone: string }[];
  travelerIds: string[];
};

/** Hotels' usual times, used as defaults in the form. */
export const DEFAULT_CHECK_IN_TIME = "15:00";
export const DEFAULT_CHECK_OUT_TIME = "11:00";

const MAX_NIGHTS = 90;

export function parseAccommodationForm(
  formData: FormData,
  { trip, stops, travelerIds }: Context,
):
  | { ok: true; data: AccommodationData; participantIds: string[]; values: AccommodationFormValues }
  | { ok: false; fieldErrors: Partial<Record<AccommodationField, string>>; values: AccommodationFormValues } {
  const values: AccommodationFormValues = {
    participants: formData.getAll("participants").map(String),
    name: text(formData, "name"),
    trip_stop_id: text(formData, "trip_stop_id"),
    timezone: text(formData, "timezone"),
    check_in_date: text(formData, "check_in_date"),
    check_in_time: text(formData, "check_in_time"),
    check_out_date: text(formData, "check_out_date"),
    check_out_time: text(formData, "check_out_time"),
    address: text(formData, "address"),
    booking_status: text(formData, "booking_status") || "planned",
    booking_ref: text(formData, "booking_ref"),
    booking_url: text(formData, "booking_url"),
    cost_amount: text(formData, "cost_amount"),
    cost_currency: text(formData, "cost_currency") || trip.currency,
    notes: text(formData, "notes"),
    google_place_id: text(formData, "google_place_id"),
    lat: text(formData, "lat"),
    lng: text(formData, "lng"),
  };

  const errors: Partial<Record<AccommodationField, string>> = {};

  if (!values.name) errors.name = "¿Dónde se quedan? Escribe el nombre del hotel o alojamiento.";
  else if (values.name.length > 160) errors.name = "Máximo 160 caracteres.";

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
    errors.timezone = "Elige una zona de la lista, por ejemplo Europe/London.";
  } else {
    timezone = values.timezone;
  }

  const inTrip = (date: string) =>
    !trip.start_date || !trip.end_date || (date >= trip.start_date && date <= trip.end_date);
  const tripRange = trip.start_date && trip.end_date ? formatTripDates(trip.start_date, trip.end_date) : "";

  if (!values.check_in_date) errors.check_in_date = "Elige el día de llegada.";
  else if (!isIsoDate(values.check_in_date)) errors.check_in_date = "Fecha no válida.";
  else if (!inTrip(values.check_in_date)) errors.check_in_date = `Debe estar dentro del viaje (${tripRange}).`;

  if (!values.check_out_date) errors.check_out_date = "Elige el día de salida.";
  else if (!isIsoDate(values.check_out_date)) errors.check_out_date = "Fecha no válida.";
  else if (!inTrip(values.check_out_date)) errors.check_out_date = `Debe estar dentro del viaje (${tripRange}).`;

  if (!isTime(values.check_in_time)) errors.check_in_time = "Elige la hora.";
  if (!isTime(values.check_out_time)) errors.check_out_time = "Elige la hora.";

  let checkIn: Date | null = null;
  let checkOut: Date | null = null;
  if (timezone && !errors.check_in_date && !errors.check_in_time && !errors.check_out_date && !errors.check_out_time) {
    checkIn = zonedTimeToInstant(values.check_in_date, values.check_in_time, timezone);
    checkOut = zonedTimeToInstant(values.check_out_date, values.check_out_time, timezone);
    if (checkOut <= checkIn) errors.check_out_date = "La salida debe ser después de la llegada.";
    else if (checkOut.getTime() - checkIn.getTime() > MAX_NIGHTS * 86_400_000) errors.check_out_date = "Máximo 90 noches.";
  }

  if (values.address.length > 300) errors.address = "Máximo 300 caracteres.";
  const location = parseLocation(formData);
  if (!location) errors.address = "La ubicación elegida no es válida. Búscala de nuevo.";
  if (values.booking_ref.length > 120) errors.booking_ref = "Máximo 120 caracteres.";
  if (values.notes.length > 2000) errors.notes = "Máximo 2000 caracteres.";

  let cost: number | null = null;
  if (values.cost_amount) {
    cost = parseAmount(values.cost_amount);
    if (Number.isNaN(cost)) errors.cost_amount = "Escribe un monto, por ejemplo 3500 o 1250.50.";
  }
  if (cost !== null && !isOfferedCurrency(values.cost_currency)) errors.cost_currency = "Elige una moneda de la lista.";

  let url: string | null = null;
  if (values.booking_url) {
    url = parseHttpUrl(values.booking_url);
    if (!url) errors.booking_url = "Escribe un enlace que empiece con https://";
    else if (url.length > 2000) errors.booking_url = "El enlace es demasiado largo.";
  }

  // Same rule as activities: all checked = "everyone" (stored as no rows);
  // none checked is a mistake.
  const participantIds = [...new Set(values.participants)];
  if (participantIds.some((id) => !travelerIds.includes(id))) {
    errors.participants = "Elige personas de este viaje.";
  } else if (travelerIds.length > 0 && participantIds.length === 0) {
    errors.participants = "Elige al menos a una persona.";
  }

  if (Object.keys(errors).length > 0 || !timezone || !checkIn || !checkOut) {
    return { ok: false, fieldErrors: errors, values };
  }

  return {
    ok: true,
    values,
    participantIds,
    data: {
      name: values.name,
      trip_stop_id: values.trip_stop_id || null,
      timezone,
      check_in_at: checkIn.toISOString(),
      check_out_at: checkOut.toISOString(),
      address: values.address || null,
      booking_status: values.booking_status as BookingStatus,
      booking_ref: values.booking_ref || null,
      booking_url: url,
      cost_amount: cost,
      cost_currency: cost !== null ? values.cost_currency : null,
      notes: values.notes || null,
      ...location!,
    },
  };
}
