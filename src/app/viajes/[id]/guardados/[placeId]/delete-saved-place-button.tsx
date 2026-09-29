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

import { deleteSavedPlace } from "../actions";

type Props = { tripId: string; placeId: string; title: string };

export function DeleteSavedPlaceButton({ tripId, placeId, title }: Props) {
  const [state, action, pending] = useActionState(deleteSavedPlace.bind(null, tripId, placeId), undefined);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full sm:w-auto">
          <Trash2 aria-hidden="true" />
          Borrar lugar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>Si ya está en el itinerario, esa actividad se queda. Esta acción no se puede deshacer.</AlertDialogDescription>
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
