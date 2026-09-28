"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TimeZoneOption } from "@/lib/time-zones";
import type { StopFormState, StopFormValues } from "@/lib/trips/stop-form";

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

  const describedBy = (field: keyof StopFormValues, hint?: boolean) =>
    [errors[field] ? `${field}-error` : null, hint ? `${field}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field id="name" label="Ciudad" error={errors.name}>
        <Input
          id="name"
          name="name"
          maxLength={120}
          placeholder="Londres"
          defaultValue={values?.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name")}
          className="h-11"
        />
      </Field>

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
        {/* A text input with suggestions: ~400 zones are too many for a plain select. */}
        <Input
          id="timezone"
          name="timezone"
          list="timezone-options"
          autoComplete="off"
          spellCheck={false}
          placeholder="Europe/London"
          defaultValue={values?.timezone}
          aria-invalid={Boolean(errors.timezone)}
          aria-describedby={describedBy("timezone", true)}
          className="h-11"
        />
        <datalist id="timezone-options">
          {timeZones.map((tz) => (
            <option key={tz.id} value={tz.id}>
              {tz.offset}
            </option>
          ))}
        </datalist>
        <p id="timezone-hint" className="text-xs text-muted-foreground">
          Escribe el continente o la ciudad en inglés: “Europe/London”, “Europe/Madrid”, “America/New_York”. Las
          horas de las actividades en esta ciudad se mostrarán en esta zona.
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
