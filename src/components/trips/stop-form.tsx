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
import { isStopKind, STOP_KIND_META, STOP_KINDS, type StopKind } from "@/lib/trips/stops";

import { STOP_KIND_ICON } from "./stop-kind-icons";

type StopFormProps = {
  action: (prev: StopFormState, formData: FormData) => Promise<StopFormState>;
  initialValues?: StopFormValues;
  /** Preselected kind for a new stop. */
  initialKind?: StopKind;
  /** Another stop is already the origin: only one per trip. */
  hasOrigin?: boolean;
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
  initialKind = "destination",
  hasOrigin = false,
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
  const [kind, setKind] = useState<StopKind>(isStopKind(values?.kind) ? values.kind : initialKind);

  const describedBy = (field: StopField, hint?: boolean) =>
    [errors[field] ? `${field}-error` : null, hint ? `${field}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">En este viaje es…</legend>
        <div className="grid grid-cols-3 gap-2">
          {STOP_KINDS.map((k) => {
            const Icon = STOP_KIND_ICON[k];
            const checked = kind === k;
            const disabled = k === "origin" && hasOrigin && !checked;
            return (
              <label
                key={k}
                className={
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50 " +
                  (checked ? "border-primary bg-secondary font-semibold text-secondary-foreground" : "bg-card text-foreground/80") +
                  (disabled ? " cursor-not-allowed opacity-50" : " cursor-pointer")
                }
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setKind(k)}
                  className="sr-only"
                />
                <Icon className="size-5" aria-hidden="true" />
                {STOP_KIND_META[k].label}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {STOP_KIND_META[kind].hint}
          {kind === "origin" && " Va primero en la ruta y el mapa la usa para el regreso. No pide fechas ni hospedaje."}
          {kind === "transit" && " No pide hospedaje."}
          {hasOrigin && kind !== "origin" && " Este viaje ya tiene ciudad de origen."}
        </p>
        {errors.kind && <p className="text-sm text-destructive">{errors.kind}</p>}
      </fieldset>

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

      {/* Home has no stay; hidden fields would still be dropped by the server. */}
      <fieldset className={kind === "origin" ? "hidden" : "flex flex-col gap-2"} disabled={kind === "origin"}>
        <legend className="text-sm font-medium">{kind === "transit" ? "Cuándo pasas" : "Estancia"}</legend>
        <p className="text-xs text-muted-foreground">
          {kind === "transit" ? "Normalmente llegas y sales el mismo día." : "Opcional: puedes agregarla después."}
        </p>
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
