import { isBookingStatus, type BookingStatus } from "@/lib/activities/categories";
import { isTime, parseAmount, parseHttpUrl, text } from "@/lib/form-fields";
import { isKnownTimeZone } from "@/lib/time-zones";
import { isOfferedCurrency } from "@/lib/trips/currencies";
import { formatTripDates } from "@/lib/trips/dates";
import { isIsoDate } from "@/lib/trips/trip-form";
import { zonedTimeToInstant } from "@/lib/zoned-time";

import { isTransportType, TRANSPORT_META, type TransportType } from "./types";

/**
 * Parsing and validation for the transportation form. Runs on the server.
 * Each end has its own local date, time and time zone: "sale 08:10 en
 * Europe/London, llega 11:30 en Europe/Warsaw". Both become instants here.
 * The city shortcuts in the form only fill these fields in; the server
 * validates whatever zone is submitted.
 */

export type TransportField =
  | "type"
  | "origin_name"
  | "departs_timezone"
  | "departs_date"
  | "departs_time"
  | "departure_detail"
  | "destination_name"
  | "arrives_timezone"
  | "arrives_date"
  | "arrives_time"
  | "arrival_detail"
  | "carrier"
  | "service_number"
  | "booking_status"
  | "booking_ref"
  | "booking_url"
  | "cost_amount"
  | "cost_currency"
  | "notes"
  | "participants";

export type TransportFormValues = Record<Exclude<TransportField, "participants">, string> & {
  /** Checked traveler ids. All of them checked (and no seats) means "everyone". */
  participants: string[];
  /** Seat per traveler id, e.g. { "…": "14A" }. */
  seats: Record<string, string>;
};

export type TransportFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<TransportField, string>>;
      values?: TransportFormValues;
    }
  | undefined;

export type TransportData = {
  type: TransportType;
  origin_name: string;
  destination_name: string;
  departs_at: string;
  departs_timezone: string;
  arrives_at: string;
  arrives_timezone: string;
  departure_detail: string | null;
  arrival_detail: string | null;
  carrier: string | null;
  service_number: string | null;
  booking_status: BookingStatus;
  booking_ref: string | null;
  booking_url: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  notes: string | null;
};

type Context = {
  trip: { start_date: string | null; end_date: string | null; currency: string };
  travelerIds: string[];
};

const MAX_DAYS = 90;
const MAX_SEAT = 20;

export function parseTransportForm(
  formData: FormData,
  { trip, travelerIds }: Context,
):
  | { ok: true; data: TransportData; travelers: { traveler_id: string; seat: string | null }[]; values: TransportFormValues }
  | { ok: false; fieldErrors: Partial<Record<TransportField, string>>; values: TransportFormValues } {
  const participants = formData.getAll("participants").map(String);
  const seats: Record<string, string> = {};
  for (const id of travelerIds) {
    const seat = text(formData, `seat_${id}`);
    if (seat) seats[id] = seat;
  }

  const values: TransportFormValues = {
    participants,
    seats,
    type: text(formData, "type") || "flight",
    origin_name: text(formData, "origin_name"),
    departs_timezone: text(formData, "departs_timezone"),
    departs_date: text(formData, "departs_date"),
    departs_time: text(formData, "departs_time"),
    departure_detail: text(formData, "departure_detail"),
    destination_name: text(formData, "destination_name"),
    arrives_timezone: text(formData, "arrives_timezone"),
    arrives_date: text(formData, "arrives_date"),
    arrives_time: text(formData, "arrives_time"),
    arrival_detail: text(formData, "arrival_detail"),
    carrier: text(formData, "carrier"),
    service_number: text(formData, "service_number"),
    booking_status: text(formData, "booking_status") || "planned",
    booking_ref: text(formData, "booking_ref"),
    booking_url: text(formData, "booking_url"),
    cost_amount: text(formData, "cost_amount"),
    cost_currency: text(formData, "cost_currency") || trip.currency,
    notes: text(formData, "notes"),
  };

  const errors: Partial<Record<TransportField, string>> = {};

  if (!isTransportType(values.type)) errors.type = "Elige un tipo de la lista.";
  if (!isBookingStatus(values.booking_status)) errors.booking_status = "Elige un estado de la lista.";

  if (!values.origin_name) errors.origin_name = "¿De dónde sale?";
  else if (values.origin_name.length > 160) errors.origin_name = "Máximo 160 caracteres.";
  if (!values.destination_name) errors.destination_name = "¿A dónde llega?";
  else if (values.destination_name.length > 160) errors.destination_name = "Máximo 160 caracteres.";

  const zone = (value: string, field: "departs_timezone" | "arrives_timezone") => {
    if (!value) errors[field] = "Elige la zona horaria (o una ciudad del viaje).";
    else if (!isKnownTimeZone(value)) errors[field] = "Elige una zona de la lista: busca la ciudad, por ejemplo “Miami”.";
  };
  zone(values.departs_timezone, "departs_timezone");
  zone(values.arrives_timezone, "arrives_timezone");

  if (!values.departs_date) errors.departs_date = "Elige el día.";
  else if (!isIsoDate(values.departs_date)) errors.departs_date = "Fecha no válida.";
  else if (trip.start_date && trip.end_date && (values.departs_date < trip.start_date || values.departs_date > trip.end_date)) {
    errors.departs_date = `Debe salir dentro del viaje (${formatTripDates(trip.start_date, trip.end_date)}).`;
  }
  // The arrival may fall after the trip's last day (a red-eye home), so only its format is checked.
  if (!values.arrives_date) errors.arrives_date = "Elige el día.";
  else if (!isIsoDate(values.arrives_date)) errors.arrives_date = "Fecha no válida.";
  if (!isTime(values.departs_time)) errors.departs_time = "Elige la hora.";
  if (!isTime(values.arrives_time)) errors.arrives_time = "Elige la hora.";

  let departs: Date | null = null;
  let arrives: Date | null = null;
  const timesOk = ["departs_timezone", "arrives_timezone", "departs_date", "arrives_date", "departs_time", "arrives_time"].every(
    (f) => !errors[f as TransportField],
  );
  if (timesOk) {
    departs = zonedTimeToInstant(values.departs_date, values.departs_time, values.departs_timezone);
    arrives = zonedTimeToInstant(values.arrives_date, values.arrives_time, values.arrives_timezone);
    if (arrives <= departs) errors.arrives_time = "La llegada debe ser después de la salida (cada hora en su zona).";
    else if (arrives.getTime() - departs.getTime() > MAX_DAYS * 86_400_000) errors.arrives_date = "Máximo 90 días.";
  }

  if (values.departure_detail.length > 160) errors.departure_detail = "Máximo 160 caracteres.";
  if (values.arrival_detail.length > 160) errors.arrival_detail = "Máximo 160 caracteres.";
  if (values.carrier.length > 120) errors.carrier = "Máximo 120 caracteres.";
  if (values.service_number.length > 40) errors.service_number = "Máximo 40 caracteres.";
  if (values.booking_ref.length > 120) errors.booking_ref = "Máximo 120 caracteres.";
  if (values.notes.length > 2000) errors.notes = "Máximo 2000 caracteres.";

  let cost: number | null = null;
  if (values.cost_amount) {
    cost = parseAmount(values.cost_amount);
    if (Number.isNaN(cost)) errors.cost_amount = "Escribe un monto, por ejemplo 2400 o 1250.50.";
  }
  if (cost !== null && !isOfferedCurrency(values.cost_currency)) errors.cost_currency = "Elige una moneda de la lista.";

  let url: string | null = null;
  if (values.booking_url) {
    url = parseHttpUrl(values.booking_url);
    if (!url) errors.booking_url = "Escribe un enlace que empiece con https://";
    else if (url.length > 2000) errors.booking_url = "El enlace es demasiado largo.";
  }

  const participantIds = [...new Set(participants)];
  if (participantIds.some((id) => !travelerIds.includes(id))) {
    errors.participants = "Elige personas de este viaje.";
  } else if (travelerIds.length > 0 && participantIds.length === 0) {
    errors.participants = "Elige al menos a una persona.";
  } else if (participantIds.some((id) => (seats[id]?.length ?? 0) > MAX_SEAT)) {
    errors.participants = "Cada asiento: máximo 20 caracteres.";
  }

  if (Object.keys(errors).length > 0 || !departs || !arrives || !isTransportType(values.type)) {
    return { ok: false, fieldErrors: errors, values };
  }

  // Car rentals have no service number; drop anything left from another type.
  const hasNumber = TRANSPORT_META[values.type].number !== null;

  return {
    ok: true,
    values,
    // Seats only for the travelers who are checked.
    travelers: participantIds.map((id) => ({ traveler_id: id, seat: seats[id] ?? null })),
    data: {
      type: values.type,
      origin_name: values.origin_name,
      destination_name: values.destination_name,
      departs_at: departs.toISOString(),
      departs_timezone: values.departs_timezone,
      arrives_at: arrives.toISOString(),
      arrives_timezone: values.arrives_timezone,
      departure_detail: values.departure_detail || null,
      arrival_detail: values.arrival_detail || null,
      carrier: values.carrier || null,
      service_number: hasNumber ? values.service_number || null : null,
      booking_status: values.booking_status as BookingStatus,
      booking_ref: values.booking_ref || null,
      booking_url: url,
      cost_amount: cost,
      cost_currency: cost !== null ? values.cost_currency : null,
      notes: values.notes || null,
    },
  };
}
