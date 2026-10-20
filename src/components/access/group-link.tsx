"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Link2, Loader2, UserCheck, UsersRound, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccessActionState, CreateGroupLinkState } from "@/app/viajes/[id]/viajeros/access-actions";

import { ROLE_OPTIONS } from "./invite-form";
import { InviteLink } from "./invite-link";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type GroupLinkFormProps = {
  /** createGroupLink already bound to the trip by the page (server side). */
  action: (prev: CreateGroupLinkState, formData: FormData) => Promise<CreateGroupLinkState>;
  tripName: string;
  /** There's an active link already: creating one replaces it. */
  replaces: boolean;
};

/** Owner only: create (or replace) the trip's group link and share it. */
export function GroupLinkForm({ action: serverAction, tripName, replaces }: GroupLinkFormProps) {
  const [state, action, pending] = useActionState(serverAction, undefined);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-days">Dura</Label>
            <select id="group-days" name="days" defaultValue="7" className={selectClass}>
              <option value="1">1 día</option>
              <option value="7">7 días</option>
              <option value="30">30 días</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-max">
              Máximo <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="group-max"
              name="max"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              placeholder="Sin límite"
              aria-describedby="group-max-hint"
              className="h-11"
            />
          </div>
        </div>
        <p id="group-max-hint" className="-mt-2 text-xs text-muted-foreground">
          Máximo de personas que puedes aceptar con este enlace, por ejemplo cuántos son en el grupo.
        </p>

        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" variant={state?.token || replaces ? "outline" : "default"} disabled={pending}>
          <Link2 aria-hidden="true" />
          {pending ? "Creando…" : state?.token || replaces ? "Crear un enlace nuevo" : "Crear enlace para grupo"}
        </Button>
        {replaces && !state?.token && (
          <p className="-mt-2 text-xs text-muted-foreground">El enlace anterior dejará de funcionar.</p>
        )}
      </form>

      {state?.token && state.expiresAt && (
        <InviteLink key={state.token} token={state.token} tripName={tripName} expiresAt={state.expiresAt} group />
      )}
    </div>
  );
}

type Result = Promise<AccessActionState>;

/** "Desactivar" on the active group link: it stops working, requests stay. */
export function RevokeGroupLinkButton({ revoke }: { revoke: () => Result }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 text-destructive hover:text-destructive"
        disabled={pending}
        aria-label="Desactivar el enlace para grupo"
        onClick={() =>
          start(async () => {
            const result = await revoke();
            setError(result?.error ?? null);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
        Desactivar
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

type DecideProps = {
  name: string;
  /** Travelers without an account, offered in "¿Viaja?". */
  travelers: { id: string; name: string }[];
  /** decideJoinRequest already bound to the trip and the request. */
  decide: (decision: { approve: boolean; role?: string; for?: string }) => Result;
};

/**
 * Owner only: "Aceptar" opens a dialog to pick the access and whether the
 * person travels (never automatic: a new traveler counts in everything that's
 * for "everyone"); "Rechazar" answers no right away.
 */
export function JoinRequestActions({ name, travelers, decide }: DecideProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("viewer");
  const [target, setTarget] = useState("follow");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(decision: { approve: boolean; role?: string; for?: string }) {
    start(async () => {
      const result = await decide(decision);
      setError(result?.error ?? null);
      if (!result?.error) setOpen(false);
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-destructive hover:text-destructive"
          disabled={pending}
          aria-label={`Rechazar a ${name}`}
          onClick={() => run({ approve: false })}
        >
          {pending && !open ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
          Rechazar
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError(null);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" className="h-9" disabled={pending} aria-label={`Aceptar a ${name}`}>
              <Check aria-hidden="true" />
              Aceptar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Aceptar a {name}?</AlertDialogTitle>
              <AlertDialogDescription>Podrá ver el viaje y sus documentos en cuanto lo aceptes.</AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="join-for">¿Viaja?</Label>
              <select id="join-for" value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass} disabled={pending}>
                <option value="follow">No, solo seguirá el viaje</option>
                <option value="new">Sí, agregarlo como viajero nuevo</option>
                {travelers.length > 0 && (
                  <optgroup label="Sí, es uno de estos viajeros">
                    {travelers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                {target === "new"
                  ? `Se agregará como viajero con el nombre "${name}" y contará en los planes y gastos que son de todos.`
                  : target === "follow"
                    ? "Podrá ver el viaje, pero no aparecerá como viajero."
                    : "Su cuenta queda vinculada a ese viajero."}
              </p>
            </div>

            <fieldset className="flex flex-col gap-2" disabled={pending}>
              <legend className="mb-2 text-sm font-medium">Acceso al viaje</legend>
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary"
                >
                  <input
                    type="radio"
                    name="join-role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="mt-1 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button disabled={pending} onClick={() => run({ approve: true, role, for: target })}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                {pending ? "Guardando…" : "Aceptar"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </span>
      {error && !open && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Decorative icon for the group link card. */
export function GroupLinkIcon() {
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
      <UsersRound className="size-4" />
    </span>
  );
}
