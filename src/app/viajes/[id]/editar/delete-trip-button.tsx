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

import { deleteTrip } from "./actions";

export function DeleteTripButton({ tripId, tripName }: { tripId: string; tripName: string }) {
  const [state, action, pending] = useActionState(deleteTrip.bind(null, tripId), undefined);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full sm:w-auto">
          <Trash2 aria-hidden="true" />
          Borrar viaje
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar “{tripName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrará el viaje para todas las personas con acceso. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        {/* A plain submit button, not AlertDialogAction: that one closes the
            dialog on click, hiding the pending state and any error. */}
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
