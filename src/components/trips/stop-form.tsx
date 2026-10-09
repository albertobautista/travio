"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { PlaceFields } from "@/components/maps/place-fields";
import { TimeZoneField } from "@/components/time-zone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TimeZoneOption } from "@/lib/time-zones";
import type { StopField, StopFormState, StopFormValues } from "@/lib/trips/stop-form";

type StopFormProps = {
  action: (prev: StopFormState, formData: FormData) => Promise<StopFormState>;
  initialValues?: StopFormValues;
  timeZones: TimeZoneOption[];
  /** "YYYY-MM-DD" bounds for the date pickers, from the trip's dates. */
  minDate?: string;
  maxDate?: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

export function StopForm({
  action: serverAction,
  initialValues,
  timeZones,
  minDate,
  maxDate,
  submitLabel,
  pendingLabel,
  cancelHref,
}: StopFormProps) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;
  // Filled by the city search; editable for places Google doesn't know.
  const [timezone, setTimezone] = useState(values?.timezone ?? "");
  const [cityName, setCityName] = useState(values?.name ?? "");

  const describedBy = (field: StopField, hint?: boolean) =>
    [errors[field] ? `${field}-error` : null, hint ? `${field}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/* Picking the city from Google saves where it is (for the map) and its time zone. */}
      <PlaceFields
        nameField="name"
        nameLabel="Ciudad"
        namePlaceholder="Londres"
        maxNameLength={120}
        initial={{
          name: values?.name ?? "",
          address: "",
          placeId: values?.google_place_id ?? "",
          lat: values?.lat ?? "",
          lng: values?.lng ?? "",
        }}
        errors={{ name: errors.name }}
        showAddress={false}
        includedPrimaryTypes={["(cities)"]}
        onPicked={({ name, timeZone }) => {
          setCityName(name);
          if (timeZone) setTimezone(timeZone);
        }}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Estancia</legend>
        <p className="text-xs text-muted-foreground">Opcional: puedes agregarla después.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="arrives_on" label="Llegada" error={errors.arrives_on} small>
            <Input
              id="arrives_on"
              name="arrives_on"
              type="date"
              min={minDate}
              max={maxDate}
              defaultValue={values?.arrives_on}
              aria-invalid={Boolean(errors.arrives_on)}
              aria-describedby={describedBy("arrives_on")}
              className="h-11"
            />
          </Field>
          <Field id="departs_on" label="Salida" error={errors.departs_on} small>
            <Input
              id="departs_on"
              name="departs_on"
              type="date"
              min={minDate}
              max={maxDate}
              defaultValue={values?.departs_on}
              aria-invalid={Boolean(errors.departs_on)}
              aria-describedby={describedBy("departs_on")}
              className="h-11"
            />
          </Field>
        </div>
      </fieldset>

      <Field id="timezone" label="Zona horaria" error={errors.timezone}>
        <TimeZoneField
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={setTimezone}
          options={timeZones}
          placeName={cityName}
          invalid={Boolean(errors.timezone)}
          describedBy={describedBy("timezone", true)}
        />
        <p id="timezone-hint" className="text-xs text-muted-foreground">
          Se llena sola al elegir la ciudad de la lista. Las horas de las actividades en esta ciudad se mostrarán en esta
          zona.
        </p>
      </Field>

      <Field id="notes" label="Notas" error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Barrios, pendientes, recomendaciones…"
          defaultValue={values?.notes}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={describedBy("notes")}
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
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  small,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={small ? "text-xs text-muted-foreground" : undefined}>
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
