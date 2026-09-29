"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Moon } from "lucide-react";

import { Field, selectClass } from "@/components/form-field";
import { ParticipantsField } from "@/components/travelers/participants-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AccommodationField,
  AccommodationFormState,
  AccommodationFormValues,
} from "@/lib/accommodations/accommodation-form";
import { BOOKING_META, BOOKING_STATUSES } from "@/lib/activities/categories";
import type { TimeZoneOption } from "@/lib/time-zones";
import { CURRENCIES } from "@/lib/trips/currencies";

type Stop = { id: string; name: string; timezone: string; arrives_on: string | null; departs_on: string | null };
type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  action: (prev: AccommodationFormState, formData: FormData) => Promise<AccommodationFormState>;
  initialValues: AccommodationFormValues;
  stops: Stop[];
  travelers: Traveler[];
  timeZones: TimeZoneOption[];
  minDate?: string;
  maxDate?: string;
  submitLabel: string;
  cancelHref: string;
};

function nightsBetween(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function AccommodationForm({
  action: serverAction,
  initialValues,
  stops,
  travelers,
  timeZones,
  minDate,
  maxDate,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors: Partial<Record<AccommodationField, string>> = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;

  // Controlled: the city fills in the dates, and the nights preview reads them.
  const [stopId, setStopId] = useState(values.trip_stop_id);
  const [timezone, setTimezone] = useState(values.timezone);
  const [checkInDate, setCheckInDate] = useState(values.check_in_date);
  const [checkOutDate, setCheckOutDate] = useState(values.check_out_date);
  const [participants, setParticipants] = useState(() => new Set(values.participants));

  function changeStop(id: string) {
    setStopId(id);
    // A stay usually matches the city's dates: fill them in if still empty.
    const stop = stops.find((s) => s.id === id);
    if (stop?.arrives_on && !checkInDate) setCheckInDate(stop.arrives_on);
    if (stop?.departs_on && !checkOutDate) setCheckOutDate(stop.departs_on);
  }

  const nights = nightsBetween(checkInDate, checkOutDate);
  const describedBy = (field: AccommodationField, extra?: string) =>
    [errors[field] ? `${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field id="name" label="Nombre" error={errors.name}>
        <Input
          id="name"
          name="name"
          maxLength={160}
          placeholder="Hotel Indigo London"
          defaultValue={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name")}
          className="h-11"
        />
      </Field>

      <Field id="trip_stop_id" label="Ciudad" error={errors.trip_stop_id}>
        <select
          id="trip_stop_id"
          name="trip_stop_id"
          value={stopId}
          onChange={(e) => changeStop(e.target.value)}
          className={selectClass}
          aria-invalid={Boolean(errors.trip_stop_id)}
          aria-describedby={describedBy("trip_stop_id", "trip_stop_id-hint")}
        >
          <option value="">Sin ciudad</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p id="trip_stop_id-hint" className="text-xs text-muted-foreground">
          Las horas de llegada y salida son las de la ciudad.
        </p>
      </Field>

      {!stopId && (
        <Field id="timezone" label="Zona horaria" error={errors.timezone}>
          <Input
            id="timezone"
            name="timezone"
            list="accommodation-timezones"
            autoComplete="off"
            spellCheck={false}
            placeholder="Europe/London"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value.trim())}
            aria-invalid={Boolean(errors.timezone)}
            aria-describedby={describedBy("timezone")}
            className="h-11"
          />
          <datalist id="accommodation-timezones">
            {timeZones.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.offset}
              </option>
            ))}
          </datalist>
        </Field>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Llegada (check-in)</legend>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field id="check_in_date" label="Día" error={errors.check_in_date}>
            <Input
              id="check_in_date"
              name="check_in_date"
              type="date"
              min={minDate}
              max={maxDate}
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              aria-invalid={Boolean(errors.check_in_date)}
              aria-describedby={describedBy("check_in_date")}
              className="h-11"
            />
          </Field>
          <Field id="check_in_time" label="Hora" error={errors.check_in_time}>
            <Input
              id="check_in_time"
              name="check_in_time"
              type="time"
              defaultValue={values.check_in_time}
              aria-invalid={Boolean(errors.check_in_time)}
              aria-describedby={describedBy("check_in_time")}
              className="h-11"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Salida (check-out)</legend>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field id="check_out_date" label="Día" error={errors.check_out_date}>
            <Input
              id="check_out_date"
              name="check_out_date"
              type="date"
              min={checkInDate || minDate}
              max={maxDate}
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              aria-invalid={Boolean(errors.check_out_date)}
              aria-describedby={describedBy("check_out_date")}
              className="h-11"
            />
          </Field>
          <Field id="check_out_time" label="Hora" error={errors.check_out_time}>
            <Input
              id="check_out_time"
              name="check_out_time"
              type="time"
              defaultValue={values.check_out_time}
              aria-invalid={Boolean(errors.check_out_time)}
              aria-describedby={describedBy("check_out_time")}
              className="h-11"
            />
          </Field>
        </div>
        {nights !== null && nights > 0 && (
          <p aria-live="polite" className="flex items-center gap-2 text-sm">
            <Moon className="size-4 text-primary" aria-hidden="true" />
            {nights === 1 ? "1 noche" : `${nights} noches`}
          </p>
        )}
      </fieldset>

      <ParticipantsField
        legend="¿Quién se queda?"
        travelers={travelers}
        selected={participants}
        onChange={setParticipants}
        error={errors.participants}
      />

      <Field id="address" label="Dirección" error={errors.address}>
        <Input
          id="address"
          name="address"
          maxLength={300}
          placeholder="1 Leman St, London E1 8EN"
          defaultValue={values.address}
          aria-describedby={describedBy("address", "address-hint")}
          className="h-11"
        />
        <p id="address-hint" className="text-xs text-muted-foreground">
          Con la dirección, Hoy te puede llevar ahí.
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="booking_status" label="Reserva" error={errors.booking_status}>
          <select id="booking_status" name="booking_status" defaultValue={values.booking_status} className={selectClass}>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_META[s].label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="booking_ref" label="Referencia" error={errors.booking_ref}>
          <Input
            id="booking_ref"
            name="booking_ref"
            maxLength={120}
            placeholder="ABC123"
            defaultValue={values.booking_ref}
            className="h-11"
          />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field id="cost_amount" label="Costo total" error={errors.cost_amount}>
          <Input
            id="cost_amount"
            name="cost_amount"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={values.cost_amount}
            aria-invalid={Boolean(errors.cost_amount)}
            aria-describedby={describedBy("cost_amount")}
            className="h-11"
          />
        </Field>
        <Field id="cost_currency" label="Moneda" error={errors.cost_currency}>
          <select id="cost_currency" name="cost_currency" defaultValue={values.cost_currency} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="booking_url" label="Enlace de la reserva" error={errors.booking_url}>
        <Input
          id="booking_url"
          name="booking_url"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={values.booking_url}
          aria-invalid={Boolean(errors.booking_url)}
          aria-describedby={describedBy("booking_url")}
          className="h-11"
        />
      </Field>

      <Field id="notes" label="Notas" error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Código de la puerta, wifi, desayuno incluido…"
          defaultValue={values.notes}
        />
      </Field>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
