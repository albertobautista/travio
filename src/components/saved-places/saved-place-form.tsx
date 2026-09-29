"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Field, selectClass } from "@/components/form-field";
import { PlaceFields } from "@/components/maps/place-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CATEGORY_META } from "@/lib/activities/categories";
import { formatDuration } from "@/lib/activities/schedule";
import {
  ESTIMATE_PRESETS,
  type SavedPlaceField,
  type SavedPlaceFormState,
  type SavedPlaceFormValues,
} from "@/lib/saved-places/saved-place-form";

type Stop = { id: string; name: string; lat?: number | null; lng?: number | null };

type Props = {
  action: (prev: SavedPlaceFormState, formData: FormData) => Promise<SavedPlaceFormState>;
  initialValues: SavedPlaceFormValues;
  stops: Stop[];
  submitLabel: string;
  cancelHref: string;
};

/** Transfers aren't something you save for later. */
const SAVEABLE = CATEGORIES.filter((c) => c !== "transfer");

export function SavedPlaceForm({ action: serverAction, initialValues, stops, submitLabel, cancelHref }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors: Partial<Record<SavedPlaceField, string>> = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;

  // The city comes first: the place search then looks near it.
  const [stopId, setStopId] = useState(values.trip_stop_id);
  const [estimate, setEstimate] = useState(values.estimated_minutes);
  const chosenStop = stops.find((s) => s.id === stopId);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Field id="trip_stop_id" label="Ciudad" error={errors.trip_stop_id}>
        <select id="trip_stop_id" name="trip_stop_id" value={stopId} onChange={(e) => setStopId(e.target.value)} className={selectClass}>
          <option value="">Sin ciudad</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <PlaceFields
        nameField="name"
        nameLabel="Lugar"
        namePlaceholder="Casa Vicens, El Xampanyet…"
        initial={{ name: values.name, address: values.address, placeId: values.google_place_id, lat: values.lat, lng: values.lng }}
        errors={{ name: errors.name, address: errors.address }}
        nearLat={chosenStop?.lat ?? null}
        nearLng={chosenStop?.lng ?? null}
      />

      <Field id="category" label="Categoría" error={errors.category}>
        <select id="category" name="category" defaultValue={values.category} className={selectClass}>
          {SAVEABLE.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          ¿Cuánto tiempo? <span className="font-normal text-muted-foreground">(aprox.)</span>
        </legend>
        <input type="hidden" name="estimated_minutes" value={estimate} />
        <div className="flex flex-wrap gap-2">
          {[null, ...ESTIMATE_PRESETS].map((m) => {
            const value = m === null ? "" : String(m);
            const active = estimate === value;
            return (
              <button
                key={value || "none"}
                type="button"
                aria-pressed={active}
                onClick={() => setEstimate(value)}
                className={
                  active
                    ? "h-9 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    : "h-9 rounded-full border bg-card px-3 text-sm text-foreground/80 hover:bg-muted"
                }
              >
                {m === null ? "No sé" : formatDuration(m)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Al agregarlo al itinerario será la duración de la actividad.</p>
        {errors.estimated_minutes && <p className="text-sm text-destructive">{errors.estimated_minutes}</p>}
      </fieldset>

      <Field id="external_url" label="¿Dónde lo viste?" error={errors.external_url}>
        <Input
          id="external_url"
          name="external_url"
          type="url"
          inputMode="url"
          placeholder="https:// (blog, video, reseña…)"
          defaultValue={values.external_url}
          aria-invalid={Boolean(errors.external_url)}
          className="h-11"
        />
      </Field>

      <Field id="notes" label="Notas" error={errors.notes}>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Recomendación de Ximena. Pedir el vermut de la casa…"
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
