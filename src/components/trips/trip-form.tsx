"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/trips/currencies";
import type { TripFormState, TripFormValues } from "@/lib/trips/trip-form";

type TripFormProps = {
  action: (prev: TripFormState, formData: FormData) => Promise<TripFormState>;
  /** Current values when editing; empty when creating. */
  initialValues?: TripFormValues;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  /** Extra controls rendered at the top of the form (e.g. the cover picker). */
  children?: React.ReactNode;
  /** Called once when the action reports a created trip instead of redirecting. */
  onCreated?: (tripId: string) => void;
  /** Work the parent is doing after the action (e.g. uploading); disables the form. */
  busyLabel?: string | null;
};

export function TripForm({
  action: serverAction,
  initialValues,
  submitLabel,
  pendingLabel,
  cancelHref,
  children,
  onCreated,
  busyLabel,
}: TripFormProps) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors = state?.fieldErrors ?? {};
  // After a failed submit, show what the user typed; otherwise the saved values.
  const values = state?.values ?? initialValues;
  // Controlled so the budget field can show the chosen currency.
  const [currency, setCurrency] = useState(values?.currency ?? DEFAULT_CURRENCY);

  const reported = useRef<string | null>(null);
  useEffect(() => {
    const id = state?.createdTripId;
    if (id && reported.current !== id && onCreated) {
      reported.current = id;
      onCreated(id);
    }
  }, [state, onCreated]);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {children}
      <FormField id="name" label="Nombre del viaje" error={errors.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder="Europa 2026"
          defaultValue={values?.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          className="h-11"
        />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Fechas</legend>
        <p className="text-xs text-muted-foreground">Opcional: puedes agregarlas después.</p>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="start_date" label="Salida" error={errors.start_date} small>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={values?.start_date}
              aria-invalid={Boolean(errors.start_date)}
              aria-describedby={errors.start_date ? "start_date-error" : undefined}
              className="h-11"
            />
          </FormField>
          <FormField id="end_date" label="Regreso" error={errors.end_date} small>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={values?.end_date}
              aria-invalid={Boolean(errors.end_date)}
              aria-describedby={errors.end_date ? "end_date-error" : undefined}
              className="h-11"
            />
          </FormField>
        </div>
      </fieldset>

      <FormField id="currency" label="Moneda del viaje" error={errors.currency}>
        <select
          id="currency"
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-invalid={Boolean(errors.currency)}
          aria-describedby={errors.currency ? "currency-error" : undefined}
          className="h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="budget_amount" label="Presupuesto total" error={errors.budget_amount}>
        <div className="relative">
          <Input
            id="budget_amount"
            name="budget_amount"
            inputMode="decimal"
            placeholder="Opcional, por ejemplo 95000"
            defaultValue={values?.budget_amount}
            aria-invalid={Boolean(errors.budget_amount)}
            aria-describedby={[errors.budget_amount ? "budget_amount-error" : null, "budget_amount-hint"].filter(Boolean).join(" ")}
            className="h-11 pr-14 font-mono"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            {currency}
          </span>
        </div>
        <p id="budget_amount-hint" className="text-xs text-muted-foreground">
          En la moneda del viaje. Lo comparas con lo planeado y lo gastado en Presupuesto.
        </p>
      </FormField>

      <FormField id="description" label="Notas" error={errors.description}>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="Ideas, motivo del viaje, pendientes…"
          defaultValue={values?.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
      </FormField>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" size="lg" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending || Boolean(busyLabel)}>
          {busyLabel ?? (pending ? pendingLabel : submitLabel)}
        </Button>
      </div>
    </form>
  );
}

function FormField({
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
