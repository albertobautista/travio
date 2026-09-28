"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { LinkAccountState } from "../actions";

type Props = {
  /** linkTravelerAccount already bound to the trip and traveler by the page (server side). */
  action: (prev: LinkAccountState, formData: FormData) => Promise<LinkAccountState>;
  name: string;
};

export function LinkAccountForm({ action: serverAction, name }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const emailError = state?.fieldErrors?.email;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="link-email">Correo de su cuenta</Label>
        <Input
          id="link-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="nombre@correo.com"
          defaultValue={state?.values?.email}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "link-email-error" : undefined}
          className="h-11"
        />
        {emailError && (
          <p id="link-email-error" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Acceso al viaje</legend>
        {[
          { value: "viewer", label: "Solo lectura", hint: "Ve el viaje, pero no puede cambiar nada." },
          { value: "editor", label: "Puede editar", hint: "Agrega y cambia actividades, ciudades y viajeros." },
        ].map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary"
          >
            <input
              type="radio"
              name="role"
              value={option.value}
              defaultChecked={(state?.values?.role ?? "viewer") === option.value}
              className="mt-1 accent-primary"
            />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Si esa cuenta ya tenía acceso al viaje, conserva el que tenía.</p>
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Vinculando…" : `Vincular a ${name}`}
      </Button>
    </form>
  );
}
