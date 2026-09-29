"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Field, selectClass } from "@/components/form-field";
import { PlaceFields } from "@/components/maps/place-fields";
import { ParticipantsField } from "@/components/travelers/participants-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityField, ActivityFormState, ActivityFormValues } from "@/lib/activities/activity-form";
import { BOOKING_META, BOOKING_STATUSES, CATEGORIES, CATEGORY_META } from "@/lib/activities/categories";
import { findConflicts, formatDuration, formatTimeRange, getEnd } from "@/lib/activities/schedule";
import type { TimeZoneOption } from "@/lib/time-zones";
import { CURRENCIES } from "@/lib/trips/currencies";
import { stopForDate } from "@/lib/trips/stops";
import { instantToZonedTime, zonedTimeToInstant } from "@/lib/zoned-time";

type Stop = {
  id: string;
  name: string;
  timezone: string;
  arrives_on: string | null;
  departs_on: string | null;
  lat?: number | null;
  lng?: number | null;
};
type OtherActivity = {
  id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  activity_participants: { traveler_id: string }[];
};
type Traveler = { id: string; name: string; color: string; avatar_url: string | null };

type ActivityFormProps = {
  action: (prev: ActivityFormState, formData: FormData) => Promise<ActivityFormState>;
  initialValues: ActivityFormValues;
  stops: Stop[];
  travelers: Traveler[];
  timeZones: TimeZoneOption[];
  /** The trip's other activities, for the live overlap check. */
  otherActivities: OtherActivity[];
  minDate?: string;
  maxDate?: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

const DURATION_PRESETS = [30, 60, 90, 120, 180, 240];

export function ActivityForm({
  action: serverAction,
  initialValues,
  stops,
  travelers,
  timeZones,
  otherActivities,
  minDate,
  maxDate,
  submitLabel,
  pendingLabel,
  cancelHref,
}: ActivityFormProps) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors: Partial<Record<ActivityField, string>> = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;

  // Fields that drive the live preview are controlled. The rest stay
  // uncontrolled and are refilled from `values` after a failed submit.
  const [stopId, setStopId] = useState(initialValues.trip_stop_id);
  const [stopTouched, setStopTouched] = useState(Boolean(initialValues.trip_stop_id));
  const [timezone, setTimezone] = useState(initialValues.timezone);
  const [date, setDate] = useState(initialValues.date);
  const [startTime, setStartTime] = useState(initialValues.start_time);
  const [hours, setHours] = useState(initialValues.duration_hours);
  const [minutes, setMinutes] = useState(initialValues.duration_minutes);
  const [participants, setParticipants] = useState(() => new Set(initialValues.participants));
  const everyone = travelers.length > 0 && travelers.every((t) => participants.has(t.id));

  function changeDate(next: string) {
    setDate(next);
    // Until the user picks a city themselves, follow the date.
    if (!stopTouched) setStopId(stopForDate(stops, next)?.id ?? stopId);
  }

  // Place search looks near the chosen city first.
  const chosenStop = stops.find((s) => s.id === stopId);
  const durationMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const activeZone = stopId ? stops.find((s) => s.id === stopId)?.timezone : timeZones.find((z) => z.id === timezone)?.id;

  const preview = useMemo(() => {
    if (!activeZone || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || durationMinutes <= 0) {
      return null;
    }
    const startsAt = zonedTimeToInstant(date, startTime, activeZone);
    const end = instantToZonedTime(getEnd(startsAt, durationMinutes), activeZone);
    const nextDay = end.date !== date;
    const conflicts =
      findConflicts([
        ...otherActivities.map((a) => ({
          id: a.id,
          title: a.title,
          startsAt: new Date(a.starts_at),
          durationMinutes: a.duration_minutes,
          participantIds: a.activity_participants.map((p) => p.traveler_id),
        })),
        { id: "__this", title: "", startsAt, durationMinutes, participantIds: everyone ? [] : [...participants] },
      ]).get("__this") ?? [];
    return {
      endLabel: `${end.time}${nextDay ? " del día siguiente" : ""}`,
      conflicts: conflicts.map((c) => {
        const other = otherActivities.find((a) => a.id === c.id)!;
        return {
          ...c,
          range: formatTimeRange(new Date(other.starts_at), other.duration_minutes, other.timezone),
        };
      }),
    };
  }, [activeZone, date, startTime, durationMinutes, otherActivities, participants, everyone]);

  const describedBy = (field: ActivityField, extra?: string) =>
    [errors[field] ? `${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field id="title" label="Actividad" error={errors.title}>
        <Input
          id="title"
          name="title"
          maxLength={160}
          placeholder="Tower Bridge"
          defaultValue={values.title}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy("title")}
          className="h-11"
        />
      </Field>

      <Field id="category" label="Categoría" error={errors.category}>
        <select id="category" name="category" defaultValue={values.category} className={selectClass} aria-invalid={Boolean(errors.category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="date" label="Día" error={errors.date}>
          <Input
            id="date"
            name="date"
            type="date"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={describedBy("date")}
            className="h-11"
          />
        </Field>
        <Field id="start_time" label="Empieza" error={errors.start_time}>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-invalid={Boolean(errors.start_time)}
            aria-describedby={describedBy("start_time")}
            className="h-11"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy("duration")}>
        <legend className="text-sm font-medium">Duración</legend>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => {
            const active = durationMinutes === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setHours(String(Math.floor(preset / 60)));
                  setMinutes(String(preset % 60));
                }}
                className={
                  active
                    ? "h-9 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    : "h-9 rounded-full border bg-card px-3 text-sm text-foreground/80 hover:bg-muted"
                }
              >
                {formatDuration(preset)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="duration_hours" className="text-xs text-muted-foreground">
              Horas
            </Label>
            <Input
              id="duration_hours"
              name="duration_hours"
              type="number"
              inputMode="numeric"
              min={0}
              max={168}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={Boolean(errors.duration)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="duration_minutes" className="text-xs text-muted-foreground">
              Minutos
            </Label>
            <Input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={Boolean(errors.duration)}
              className="h-11"
            />
          </div>
        </div>
        {errors.duration && (
          <p id="duration-error" className="text-sm text-destructive">
            {errors.duration}
          </p>
        )}
      </fieldset>

      {/* Live result, recalculated as the user types. */}
      {preview && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm">
            Termina a las <strong className="font-mono">{preview.endLabel}</strong>
          </p>
          {preview.conflicts.length > 0 ? (
            <div className="flex gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                {preview.conflicts.map((c) => (
                  <span key={c.id}>
                    Se solapa {formatDuration(c.overlapMinutes)} con <strong>{c.title}</strong> ({c.range}).
                  </span>
                ))}
                <span>Puedes guardar igualmente.</span>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-success-foreground">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Encaja sin solaparse con nada.
            </p>
          )}
        </div>
      )}

      <ParticipantsField
        legend="¿Quién va?"
        travelers={travelers}
        selected={participants}
        onChange={setParticipants}
        error={errors.participants}
      />

      <Field id="trip_stop_id" label="Ciudad" error={errors.trip_stop_id}>
        <select
          id="trip_stop_id"
          name="trip_stop_id"
          value={stopId}
          onChange={(e) => {
            setStopId(e.target.value);
            setStopTouched(true);
          }}
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
          La hora se guarda en la zona horaria de la ciudad.
        </p>
      </Field>

      {!stopId && (
        <Field id="timezone" label="Zona horaria" error={errors.timezone}>
          <Input
            id="timezone"
            name="timezone"
            list="activity-timezones"
            autoComplete="off"
            spellCheck={false}
            placeholder="Europe/London"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value.trim())}
            aria-invalid={Boolean(errors.timezone)}
            aria-describedby={describedBy("timezone")}
            className="h-11"
          />
          <datalist id="activity-timezones">
            {timeZones.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.offset}
              </option>
            ))}
          </datalist>
        </Field>
      )}

      <PlaceFields
        nameField="location_name"
        nameLabel="Lugar"
        namePlaceholder="Borough Market"
        initial={{
          name: values.location_name,
          address: values.address,
          placeId: values.google_place_id,
          lat: values.lat,
          lng: values.lng,
        }}
        errors={{ name: errors.location_name, address: errors.address }}
        nearLat={chosenStop?.lat ?? null}
        nearLng={chosenStop?.lng ?? null}
      />

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
        <Field id="reservation_ref" label="Referencia" error={errors.reservation_ref}>
          <Input
            id="reservation_ref"
            name="reservation_ref"
            maxLength={120}
            placeholder="ABC123"
            defaultValue={values.reservation_ref}
            className="h-11"
          />
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

      <Field id="external_url" label="Enlace" error={errors.external_url}>
        <Input
          id="external_url"
          name="external_url"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={values.external_url}
          aria-invalid={Boolean(errors.external_url)}
          aria-describedby={describedBy("external_url")}
          className="h-11"
        />
      </Field>

      <Field id="notes" label="Notas" error={errors.notes}>
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={values.notes} />
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
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
