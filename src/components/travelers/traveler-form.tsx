"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { TravelerFormState, TravelerFormValues } from "@/app/viajes/[id]/viajeros/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  action: (prev: TravelerFormState, formData: FormData) => Promise<TravelerFormState>;
  initialValues?: TravelerFormValues;
  /** Trip members that can be linked (not already linked to another traveler). */
  accounts: { user_id: string; name: string }[];
  submitLabel: string;
  pendingLabel: string;
  cancelHref?: string;
};

export function TravelerForm({ action: serverAction, initialValues, accounts, submitLabel, pendingLabel, cancelHref }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values ?? initialValues;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="traveler-name">Nombre</Label>
        <Input
          id="traveler-name"
          name="name"
          maxLength={80}
          placeholder="Ximena"
          defaultValue={values?.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "traveler-name-error" : undefined}
          className="h-11"
        />
        {errors.name && (
          <p id="traveler-name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      {accounts.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="traveler-account">Cuenta de Travio</Label>
          <select
            id="traveler-account"
            name="user_id"
            defaultValue={values?.user_id ?? ""}
            aria-invalid={Boolean(errors.user_id)}
            aria-describedby={errors.user_id ? "traveler-account-error traveler-account-hint" : "traveler-account-hint"}
            className="h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            <option value="">Sin cuenta</option>
            {accounts.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.name}
              </option>
            ))}
          </select>
          <p id="traveler-account-hint" className="text-xs text-muted-foreground">
            Opcional. Solo aparecen personas con acceso a este viaje.
          </p>
          {errors.user_id && (
            <p id="traveler-account-error" className="text-sm text-destructive">
              {errors.user_id}
            </p>
          )}
        </div>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {cancelHref && (
          <Button variant="outline" size="lg" asChild>
            <Link href={cancelHref}>Cancelar</Link>
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
