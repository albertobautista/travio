"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

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

type Props = {
  /** Server action bound to the chosen stay or leg. */
  action: () => Promise<{ error?: string } | undefined>;
  count: number;
};

/** After choosing: clears the options that lost, in one go. */
export function DeleteOtherOptionsButton({ action: serverAction, count }: Props) {
  const [state, action, pending] = useActionState(serverAction, undefined);
  const others = count === 1 ? "la otra opción" : `las otras ${count} opciones`;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 w-full sm:w-auto">
          <Trash2 aria-hidden="true" />
          Borrar {others}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar {others}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus archivos adjuntos se quedan en Documentos. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {/* Plain submit instead of AlertDialogAction, which would close the dialog before the result. */}
        <form action={action}>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button type="submit" disabled={pending} className="bg-destructive text-white hover:bg-destructive/90">
              {pending ? "Borrando…" : "Sí, borrar"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
