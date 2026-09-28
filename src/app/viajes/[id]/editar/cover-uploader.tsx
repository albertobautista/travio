"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { COVER_ACCEPT, COVERS_BUCKET, isCoverType, newCoverPath, validateCoverFile } from "@/lib/trips/covers";

import { removeTripCover, setTripCover } from "./cover-actions";

type Props = {
  tripId: string;
  /** Signed URL of the current cover, if any. */
  coverUrl: string | null;
};

/**
 * Upload flow:
 * 1. Check type and size here, for instant feedback (the bucket checks again).
 * 2. Upload the file from the browser straight to Supabase Storage. The file
 *    never passes through our Next.js server; Storage RLS decides if it's allowed.
 * 3. Call a Server Action to save the path on the trip and delete the old file.
 */
export function CoverUploader({ tripId, coverUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || saving;

  async function handleFile(file: File) {
    setError(null);
    const problem = validateCoverFile(file);
    if (problem || !isCoverType(file.type)) {
      setError(problem ?? "Usa una imagen JPG, PNG o WebP.");
      return;
    }

    setUploading(true);
    const path = newCoverPath(tripId, file.type);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from(COVERS_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false, // never overwrite; every cover gets a new name
      cacheControl: "3600",
    });
    setUploading(false);

    if (uploadError) {
      console.error("Cover upload failed", uploadError);
      setError("No pudimos subir la imagen. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }

    startSaving(async () => {
      const result = await setTripCover(tripId, path);
      if (result.error) setError(result.error);
    });
  }

  function handleRemove() {
    setError(null);
    startSaving(async () => {
      const result = await removeTripCover(tripId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-secondary">
        {coverUrl ? (
          // Plain <img>: signed URLs change on every page load, so Next's image
          // optimizer would re-process them each time for no benefit.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Portada actual del viaje" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-primary">
            <ImagePlus className="size-8" aria-hidden="true" />
            <span className="text-sm">Sin portada</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-foreground/60 text-sm font-medium text-white">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {uploading ? "Subiendo…" : "Guardando…"}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={COVER_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file again still fires onChange.
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlus aria-hidden="true" />
          {coverUrl ? "Cambiar foto" : "Subir foto"}
        </Button>
        {coverUrl && (
          <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={handleRemove}>
            <Trash2 aria-hidden="true" />
            Quitar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 5 MB.</p>
      <p role="status" aria-live="polite" className="sr-only">
        {uploading ? "Subiendo imagen" : saving ? "Guardando portada" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
