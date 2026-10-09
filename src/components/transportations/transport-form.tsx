"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Clock } from "lucide-react";

import { Field, selectClass } from "@/components/form-field";
import { TimeZoneField } from "@/components/time-zone-field";
import { ParticipantsField } from "@/components/travelers/participants-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOOKING_META, BOOKING_STATUSES } from "@/lib/activities/categories";
import { formatDuration } from "@/lib/activities/schedule";
import { guessTimeZone, type TimeZoneOption } from "@/lib/time-zones";
import type { TransportField, TransportFormState, TransportFormValues } from "@/lib/transportations/transport-form";
import { TRANSPORT_META, TRANSPORT_TYPES, transportMeta } from "@/lib/transportations/types";
import { CURRENCIES } from "@/lib/trips/currencies";
import { zonedTimeToInstant } from "@/lib/zoned-time";

type Stop = { id: string; name: string; timezone: string };
type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type Props = {
  action: (prev: TransportFormState, formData: FormData) => Promise<TransportFormState>;
  initialValues: TransportFormValues;
  stops: Stop[];
  travelers: Traveler[];
  timeZones: TimeZoneOption[];
  minDate?: string;
  maxDate?: string;
  submitLabel: string;
  cancelHref: string;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => /^\d{2}:\d{2}$/.test(v);

export function TransportForm({
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
  const errors: Partial<Record<TransportField, string>> = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;

  const [type, setType] = useState(values.type);
  // `guessed`: the zone came from the place's name, so retyping the name may change it.
  const [origin, setOrigin] = useState({ name: values.origin_name, zone: values.departs_timezone, guessed: false });
  const [destination, setDestination] = useState({ name: values.destination_name, zone: values.arrives_timezone, guessed: false });
  const [departsDate, setDepartsDate] = useState(values.departs_date);
  const [departsTime, setDepartsTime] = useState(values.departs_time);
  const [arrivesDate, setArrivesDate] = useState(values.arrives_date);
  const [arrivesTime, setArrivesTime] = useState(values.arrives_time);
  const [participants, setParticipants] = useState(() => new Set(values.participants));
  const meta = transportMeta(type);
  const zones = new Set(timeZones.map((z) => z.id));

  // Real duration: each end converted with its own zone, so a London→Krakow
  // flight shows 1 h 20 min even though the clocks say 2 h 20 min apart.
  const minutes =
    isDate(departsDate) && isTime(departsTime) && isDate(arrivesDate) && isTime(arrivesTime) && zones.has(origin.zone) && zones.has(destination.zone)
      ? Math.round(
          (zonedTimeToInstant(arrivesDate, arrivesTime, destination.zone).getTime() -
            zonedTimeToInstant(departsDate, departsTime, origin.zone).getTime()) /
            60_000,
        )
      : null;

  /** Typing "Miami (MIA)" fills in Miami's zone, unless one was chosen by hand. */
  function typeName(place: typeof origin, name: string) {
    const guess = !place.zone || place.guessed ? guessTimeZone(name) : null;
    return guess ? { name, zone: guess, guessed: true } : { ...place, name };
  }
  const tripZones = stops.map((s) => s.timezone);

  const describedBy = (field: TransportField, extra?: string) =>
    [errors[field] ? `${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  function cityShortcuts(onPick: (stop: Stop) => void, current: string, label: string) {
    if (stops.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {stops.map((s) => {
          const active = current === s.name;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(s)}
              className={
                active
                  ? "h-9 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
                  : "h-9 rounded-full border bg-card px-3 text-sm text-foreground/80 hover:bg-muted"
              }
            >
              {s.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-3 gap-2">
          {TRANSPORT_TYPES.map((t) => {
            const Icon = TRANSPORT_META[t].icon;
            const checked = type === t;
            return (
              <label
                key={t}
                className={
                  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                  (checked ? "border-primary bg-secondary font-semibold text-secondary-foreground" : "bg-card text-foreground/80")
                }
              >
                <input type="radio" name="type" value={t} checked={checked} onChange={() => setType(t)} className="sr-only" />
                <Icon className="size-5" aria-hidden="true" />
                {TRANSPORT_META[t].label}
              </label>
            );
          })}
        </div>
        {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
      </fieldset>

      {/* Each end: place, local date/time, its time zone and details. */}
      {(
        [
          {
            side: "departs",
            title: meta.departs,
            place: origin,
            setPlace: setOrigin,
            nameField: "origin_name",
            zoneField: "departs_timezone",
            dateField: "departs_date",
            timeField: "departs_time",
            detailField: "departure_detail",
            date: departsDate,
            setDate: (d: string) => {
              setDepartsDate(d);
              // Most legs arrive the same day: follow the departure until changed.
              if (!arrivesDate || arrivesDate < d) setArrivesDate(d);
            },
            time: departsTime,
            setTime: setDepartsTime,
            detailPlaceholder: meta.departureDetail,
            min: minDate,
            max: maxDate,
          },
          {
            side: "arrives",
            title: meta.arrives,
            place: destination,
            setPlace: setDestination,
            nameField: "destination_name",
            zoneField: "arrives_timezone",
            dateField: "arrives_date",
            timeField: "arrives_time",
            detailField: "arrival_detail",
            date: arrivesDate,
            setDate: setArrivesDate,
            time: arrivesTime,
            setTime: setArrivesTime,
            detailPlaceholder: meta.arrivalDetail,
            min: departsDate || minDate,
            max: undefined,
          },
        ] as const
      ).map((end) => (
        <fieldset key={end.side} className="flex flex-col gap-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">{end.title}</legend>
          <Field id={end.nameField} label={end.side === "departs" ? "Desde" : "Hasta"} error={errors[end.nameField]}>
            <Input
              id={end.nameField}
              name={end.nameField}
              maxLength={160}
              placeholder={end.side === "departs" ? "Londres Heathrow (LHR)" : "Cracovia (KRK)"}
              value={end.place.name}
              onChange={(e) => end.setPlace(typeName(end.place, e.target.value))}
              aria-invalid={Boolean(errors[end.nameField])}
              aria-describedby={describedBy(end.nameField)}
              className="h-11"
            />
            {cityShortcuts(
              (s) => end.setPlace({ name: s.name, zone: s.timezone, guessed: false }),
              end.place.name,
              `Ciudades del viaje para ${end.side === "departs" ? "la salida" : "la llegada"}`,
            )}
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field id={end.dateField} label="Día" error={errors[end.dateField]}>
              <Input
                id={end.dateField}
                name={end.dateField}
                type="date"
                min={end.min}
                max={end.max}
                value={end.date}
                onChange={(e) => end.setDate(e.target.value)}
                aria-invalid={Boolean(errors[end.dateField])}
                aria-describedby={describedBy(end.dateField)}
                className="h-11"
              />
            </Field>
            <Field id={end.timeField} label="Hora local" error={errors[end.timeField]}>
              <Input
                id={end.timeField}
                name={end.timeField}
                type="time"
                value={end.time}
                onChange={(e) => end.setTime(e.target.value)}
                aria-invalid={Boolean(errors[end.timeField])}
                aria-describedby={describedBy(end.timeField)}
                className="h-11"
              />
            </Field>
          </div>
          <Field id={end.zoneField} label="Zona horaria" error={errors[end.zoneField]}>
            <TimeZoneField
              id={end.zoneField}
              name={end.zoneField}
              value={end.place.zone}
              onChange={(zone) => end.setPlace({ ...end.place, zone, guessed: false })}
              options={timeZones}
              suggested={tripZones}
              placeName={end.place.name}
              invalid={Boolean(errors[end.zoneField])}
              describedBy={describedBy(end.zoneField)}
            />
          </Field>
          <Field id={end.detailField} label="Terminal, andén o punto de encuentro" error={errors[end.detailField]}>
            <Input
              id={end.detailField}
              name={end.detailField}
              maxLength={160}
              placeholder={end.detailPlaceholder}
              defaultValue={values[end.detailField]}
              className="h-11"
            />
          </Field>
        </fieldset>
      ))}

      {minutes !== null && (
        <p aria-live="polite" className={"flex items-center gap-2 text-sm " + (minutes > 0 ? "" : "text-destructive")}>
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {minutes > 0
            ? `Duración real: ${formatDuration(minutes)}${origin.zone !== destination.zone ? " (con el cambio de hora)" : ""}`
            : "La llegada queda antes de la salida. Revisa las horas: cada una es la hora local de su ciudad."}
        </p>
      )}

      <div className={meta.number ? "grid grid-cols-2 gap-3" : ""}>
        <Field id="carrier" label={meta.carrier} error={errors.carrier}>
          <Input id="carrier" name="carrier" maxLength={120} defaultValue={values.carrier} className="h-11" />
        </Field>
        {meta.number && (
          <Field id="service_number" label={meta.number} error={errors.service_number}>
            <Input
              id="service_number"
              name="service_number"
              maxLength={40}
              placeholder={type === "flight" ? "BA 882" : ""}
              defaultValue={values.service_number}
              className="h-11"
            />
          </Field>
        )}
      </div>

      <ParticipantsField
        legend="¿Quién viaja?"
        travelers={travelers}
        selected={participants}
        onChange={setParticipants}
        error={errors.participants}
      />

      {participants.size > 0 && type !== "car_rental" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            Asientos <span className="font-normal text-muted-foreground">(opcional)</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {travelers
              .filter((t) => participants.has(t.id))
              .map((t) => (
                <div key={t.id} className="flex flex-col gap-1">
                  <Label htmlFor={`seat_${t.id}`} className="truncate text-xs text-muted-foreground">
                    {t.name}
                  </Label>
                  <Input
                    id={`seat_${t.id}`}
                    name={`seat_${t.id}`}
                    maxLength={20}
                    placeholder="14A"
                    defaultValue={values.seats[t.id] ?? ""}
                    className="h-11 font-mono"
                  />
                </div>
              ))}
          </div>
        </fieldset>
      )}

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
          <Input id="booking_ref" name="booking_ref" maxLength={120} placeholder="ABC123" defaultValue={values.booking_ref} className="h-11" />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field id="cost_amount" label="Costo" error={errors.cost_amount}>
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
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} placeholder="Equipaje incluido, llegar 2 h antes…" defaultValue={values.notes} />
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
