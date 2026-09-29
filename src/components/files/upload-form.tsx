"use client";

import { useId, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPES, FILE_ACCEPT, formatFileSize, validateFile, type DocumentType } from "@/lib/files/rules";
import { uploadTripFile } from "@/lib/files/upload";

import { registerFile } from "@/lib/files/actions";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

type Step = "idle" | "uploading" | "saving";

/**
 * Adding a document:
 * 1. Pick a file; check type and size here for instant feedback.
 * 2. Upload it from the browser straight to Storage (uploadTripFile).
 * 3. Call a Server Action to record its metadata (registerFile), which also
 *    re-checks everything and deletes the upload if it can't be saved.
 */
type Props = {
  tripId: string;
  /** Attach every upload to this activity (used on the activity's page). */
  activityId?: string;
  /** Otherwise, let the user pick an activity to attach to (optional). */
  activities?: { id: string; label: string }[];
  defaultType?: DocumentType;
  title?: string;
};

export function UploadForm({ tripId, activityId, activities, defaultType = "ticket", title = "Subir documento" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(defaultType);
  const [attachTo, setAttachTo] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = step !== "idle";

  function pick(picked: File | undefined) {
    setError(null);
    if (!picked) return;
    const problem = validateFile(picked);
    if (problem) {
      setError(problem);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(picked);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);

    setStep("uploading");
    const upload = await uploadTripFile(tripId, file);
    if ("error" in upload) {
      setError(upload.error);
      setStep("idle");
      return;
    }

    setStep("saving");
    const result = await registerFile(tripId, {
      fileId: upload.fileId,
      path: upload.path,
      originalName: file.name,
      documentType,
      activityId: activityId ?? (attachTo || null),
    });
    setStep("idle");
    if (result.error) {
      setError(result.error);
      return;
    }

    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-busy={busy}>
      <h2 className="font-semibold">{title}</h2>

      <input
        ref={inputRef}
        id={`${ids}-file`}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            disabled={busy}
            aria-label="Quitar archivo"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`${ids}-file`}
          className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/30 bg-secondary/50 p-4 text-center hover:border-primary/60 focus-within:ring-3 focus-within:ring-ring/50"
        >
          <FileUp className="size-6 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-primary">Elegir archivo</span>
          <span className="text-xs text-muted-foreground">PDF o imagen (JPG, PNG, WebP, HEIC) · máx. 10 MB</span>
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-type`} className="text-sm font-medium">
          Tipo de documento
        </label>
        <select
          id={`${ids}-type`}
          value={documentType}
          disabled={busy}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          className={selectClass}
        >
          {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {!activityId && activities && activities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-activity`} className="text-sm font-medium">
            Adjuntar a una actividad <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <select
            id={`${ids}-activity`}
            value={attachTo}
            disabled={busy}
            onChange={(e) => setAttachTo(e.target.value)}
            className={selectClass}
          >
            <option value="">Ninguna: documento del viaje</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11" disabled={!file || busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
        {step === "uploading" ? "Subiendo…" : step === "saving" ? "Guardando…" : "Subir"}
      </Button>
      <p className="sr-only" aria-live="polite">
        {step === "uploading" ? "Subiendo archivo" : step === "saving" ? "Guardando documento" : ""}
      </p>
    </form>
  );
}
