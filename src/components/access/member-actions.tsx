"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, LogOut, Settings2, UserMinus, X } from "lucide-react";

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
import type { AccessActionState } from "@/app/viajes/[id]/viajeros/access-actions";

import { ROLE_OPTIONS } from "./invite-form";

type Result = Promise<AccessActionState>;

type ManageProps = {
  name: string;
  role: "editor" | "viewer";
  /** Server Actions with the trip and member already bound. */
  changeRole: (role: string) => Result;
  remove: () => Result;
  makeOwner: () => Result;
};

/**
 * Owner only: change someone's access, give them the trip, or remove them.
 * One dialog per member; the two drastic actions ask again inside it.
 */
export function ManageMemberButton({ name, role, changeRole, remove, makeOwner }: ManageProps) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "owner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Result, closeAfter: boolean) {
    start(async () => {
      const result = await action();
      setError(result?.error ?? null);
      if (!result?.error && closeAfter) setOpen(false);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setConfirm(null);
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Gestionar el acceso de ${name}`}>
          <Settings2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {confirm === null ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Acceso de {name}</AlertDialogTitle>
              <AlertDialogDescription>Los cambios se aplican en cuanto los eliges.</AlertDialogDescription>
            </AlertDialogHeader>
            <fieldset className="flex flex-col gap-2" disabled={pending}>
              <legend className="sr-only">Tipo de acceso</legend>
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary"
                >
                  <input
                    type="radio"
                    name="member-role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => run(() => changeRole(option.value), false)}
                    className="mt-1 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1 border-t pt-3">
              <Button variant="ghost" className="h-11 justify-start" disabled={pending} onClick={() => setConfirm("owner")}>
                <Crown aria-hidden="true" />
                Hacer propietario
              </Button>
              <Button
                variant="ghost"
                className="h-11 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pending}
                onClick={() => setConfirm("remove")}
              >
                <UserMinus aria-hidden="true" />
                Quitar acceso
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                Cerrar
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm === "owner" ? `¿Hacer a ${name} propietario del viaje?` : `¿Quitarle el acceso a ${name}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm === "owner"
                  ? "Podrá gestionar quién entra al viaje y borrarlo. Tú te quedas como editor."
                  : "Dejará de ver el viaje y sus documentos. Si es viajero, sigue apareciendo en el viaje, pero sin su cuenta."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setConfirm(null)}>
                Volver
              </Button>
              <Button
                disabled={pending}
                className={confirm === "remove" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
                onClick={() => run(confirm === "owner" ? makeOwner : remove, true)}
              >
                {pending ? "Guardando…" : confirm === "owner" ? "Sí, hacer propietario" : "Sí, quitar acceso"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Members other than the owner can leave; the action redirects to Mis viajes. */
export function LeaveTripButton({ tripName, leave }: { tripName: string; leave: () => Result }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="w-full text-destructive hover:text-destructive sm:w-auto">
          <LogOut aria-hidden="true" />
          Salir del viaje
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir de {tripName}?</AlertDialogTitle>
          <AlertDialogDescription>Dejarás de verlo. Para volver necesitarás una nueva invitación.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              start(async () => {
                const result = await leave();
                setError(result?.error ?? null);
              })
            }
          >
            {pending ? "Saliendo…" : "Sí, salir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "Cancelar" on a pending invitation: its link stops working. */
export function RevokeInvitationButton({ revoke, label }: { revoke: () => Result; label: string }) {
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
        aria-label={label}
        onClick={() =>
          start(async () => {
            const result = await revoke();
            setError(result?.error ?? null);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
        Cancelar
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
