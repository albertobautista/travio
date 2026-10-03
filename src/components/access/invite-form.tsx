"use client";

import { useActionState, useState } from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CreateInvitationState } from "@/app/viajes/[id]/viajeros/access-actions";

import { InviteLink } from "./invite-link";

type Props = {
  /** createInvitation already bound to the trip by the page (server side). */
  action: (prev: CreateInvitationState, formData: FormData) => Promise<CreateInvitationState>;
  tripName: string;
  /** Travelers without an account, offered in "¿Para quién es?". */
  travelers?: { id: string; name: string }[];
  /** The invitation is for this traveler (traveler page): no picker. */
  travelerId?: string;
  submitLabel?: string;
};

export const ROLE_OPTIONS = [
  { value: "viewer", label: "Solo lectura", hint: "Ve el viaje y sus documentos, pero no puede cambiar nada." },
  { value: "editor", label: "Puede editar", hint: "Agrega y cambia actividades, ciudades, hospedajes y gastos." },
] as const;

export function InviteForm({ action: serverAction, tripName, travelers = [], travelerId, submitLabel = "Crear enlace" }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const [target, setTarget] = useState(travelerId ?? "");

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {travelerId ? (
          <input type="hidden" name="for" value={travelerId} />
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-for">¿Para quién es?</Label>
            <select
              id="invite-for"
              name="for"
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-describedby="invite-for-hint"
              className="h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="" disabled>
                Elige una opción
              </option>
              {travelers.length > 0 && (
                <optgroup label="Viajeros sin cuenta">
                  {travelers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Otra persona">
                <option value="new">Alguien nuevo que también viaja</option>
                <option value="follow">Alguien que solo seguirá el viaje</option>
              </optgroup>
            </select>
            <p id="invite-for-hint" className="text-xs text-muted-foreground">
              {target === "new"
                ? "Se agregará como viajero con el nombre de su cuenta, y contará en los planes y gastos que son de todos."
                : target === "follow"
                  ? "Podrá ver el viaje, pero no aparecerá como viajero."
                  : target
                    ? "Al aceptar, su cuenta queda vinculada a ese viajero."
                    : "Tú decides quién es; la persona que abre el enlace no puede cambiarlo."}
            </p>
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Acceso al viaje</legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                defaultChecked={option.value === "viewer"}
                className="mt-1 accent-primary"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" variant={state?.token ? "outline" : "default"} disabled={pending}>
          <Link2 aria-hidden="true" />
          {pending ? "Creando…" : state?.token ? "Crear otro enlace" : submitLabel}
        </Button>
      </form>

      {state?.token && state.expiresAt && (
        // key: a new link resets the "Copiado" state.
        <InviteLink key={state.token} token={state.token} tripName={tripName} expiresAt={state.expiresAt} />
      )}
    </div>
  );
}
