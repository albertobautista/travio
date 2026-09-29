"use client";

import { useId, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";

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
import { deleteFile, renameFile } from "@/lib/files/actions";
import { splitFileName } from "@/lib/files/rules";

type Props = { tripId: string; file: { id: string; original_name: string; mime_type: string } };

/**
 * Editors' controls for one document, in one dialog so the row only needs a
 * single button on phones: rename it, or delete it (with a second confirm).
 * Renaming only edits the name shown and used for downloads; the extension
 * stays fixed so the file still opens in the right app.
 */
export function EditFileButton({ tripId, file }: Props) {
  const inputId = useId();
  const { base, ext } = splitFileName(file.original_name, file.mime_type);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(base);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Start from the current name each time the dialog opens.
      setName(base);
      setConfirmingDelete(false);
      setError(null);
    }
  }

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Editar ${file.original_name}`}>
          <Pencil aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {confirmingDelete ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="break-words">¿Borrar “{file.original_name}”?</AlertDialogTitle>
              <AlertDialogDescription>Se borra para todos los viajeros. Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setConfirmingDelete(false)}>
                Volver
              </Button>
              {/* Plain button instead of AlertDialogAction, which would close the dialog before the result. */}
              <Button
                disabled={pending}
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => run(() => deleteFile(tripId, file.id))}
              >
                {pending ? "Borrando…" : "Sí, borrar"}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameFile(tripId, file.id, ext ? `${name}.${ext}` : name));
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Editar documento</AlertDialogTitle>
              <AlertDialogDescription>El nombre cambia para todos y se usa al descargarlo.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={inputId} className="text-sm font-medium">
                Nombre
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={240}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(error)}
                  className="h-11"
                />
                {ext && <span className="shrink-0 font-mono text-sm text-muted-foreground">.{ext}</span>}
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={() => {
                  setError(null);
                  setConfirmingDelete(true);
                }}
              >
                <Trash2 aria-hidden="true" />
                Borrar archivo
              </Button>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <Button type="submit" disabled={pending || !name.trim() || name.trim() === base}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
