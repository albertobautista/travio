"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { setTripCover } from "@/app/viajes/[id]/editar/cover-actions";
import { TripForm } from "@/components/trips/trip-form";
import { Button } from "@/components/ui/button";
import { COVER_ACCEPT, validateCoverFile } from "@/lib/trips/covers";
import { uploadCoverFile } from "@/lib/trips/upload-cover";

import { createTrip } from "./actions";

/**
 * "Nuevo viaje" with an optional cover. The photo can't be uploaded before the
 * trip exists (Storage only accepts files in folders of trips the user can
 * edit), so the order is:
 *   1. The user picks a file; we only show a local preview.
 *   2. The form creates the trip; the action returns its id instead of redirecting.
 *   3. We upload the file into the new trip's folder and save it as the cover.
 *   4. We navigate to the trip. If the upload failed, the trip still exists, so
 *      we send the user to its edit page to retry.
 */
export function NewTripForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // The picked file and a blob: URL for its local preview.
  const [cover, setCover] = useState<{ file: File; previewUrl: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const file = cover?.file ?? null;

  // Object URLs keep the file in memory until revoked: on replace, on clear
  // and when leaving the page.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function setPreview(next: { file: File; previewUrl: string } | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next?.previewUrl ?? null;
    setCover(next);
  }

  function pick(picked: File) {
    const problem = validateCoverFile(picked);
    setFileError(problem);
    if (!problem) setPreview({ file: picked, previewUrl: URL.createObjectURL(picked) });
  }

  function clear() {
    setPreview(null);
    setFileError(null);
  }

  const handleCreated = useCallback(
    async (tripId: string) => {
      if (!file) {
        router.push(`/viajes/${tripId}`);
        return;
      }
      setBusyLabel("Subiendo foto…");
      const upload = await uploadCoverFile(tripId, file);
      const saved = "path" in upload ? await setTripCover(tripId, upload.path) : upload;
      if (saved.error) {
        router.push(`/viajes/${tripId}/editar?portada=error`);
        return;
      }
      router.push(`/viajes/${tripId}`);
    },
    [file, router],
  );

  return (
    <TripForm
      action={createTrip}
      submitLabel="Crear viaje"
      pendingLabel="Creando…"
      cancelHref="/viajes"
      onCreated={handleCreated}
      busyLabel={busyLabel}
      // Whoever creates the trip is its owner.
      showAiSwitch
    >
      {/* Tells the action to return the new id instead of redirecting. */}
      <input type="hidden" name="cover" value={file ? "pending" : ""} />

      <div className="flex flex-col gap-2">
        <span id="cover-label" className="text-sm font-medium">
          Foto de portada <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-secondary">
          {cover ? (
            // Local preview of a file that isn't uploaded yet (a blob: URL).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.previewUrl} alt="Vista previa de la portada" className="size-full object-cover" />
          ) : (
            <button
              type="button"
              aria-labelledby="cover-label"
              onClick={() => inputRef.current?.click()}
              className="flex size-full flex-col items-center justify-center gap-1 text-primary hover:bg-secondary-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ImagePlus className="size-8" aria-hidden="true" />
              <span className="text-sm">Elegir foto</span>
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          // No name: the file is never sent with the form. It goes straight to
          // Storage after the trip is created.
          accept={COVER_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) pick(picked);
          }}
        />

        {file && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => inputRef.current?.click()}>
              <ImagePlus aria-hidden="true" />
              Cambiar foto
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={clear}>
              <Trash2 aria-hidden="true" />
              Quitar
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 5 MB.</p>
        {fileError && (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        )}
      </div>
    </TripForm>
  );
}
