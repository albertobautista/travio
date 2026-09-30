"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, FileText, FileUp, Loader2, X } from "lucide-react";

import { selectClass } from "@/components/form-field";
import { TargetSelect } from "@/components/files/target-select";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPES, FILE_ACCEPT, formatFileSize, mimeTypeOf, validateFile, type DocumentType } from "@/lib/files/rules";
import { parseTarget, type AttachTarget } from "@/lib/files/targets";
import { uploadTripFile } from "@/lib/files/upload";

import { registerFile } from "@/lib/files/actions";

/** At most this many files per batch: plenty for a trip's tickets, and the list stays readable. */
const MAX_FILES = 10;

type Status = "ready" | "uploading" | "saving" | "error";

type Item = {
  key: string;
  file: File;
  /** Object URL for an image thumbnail (not HEIC: most browsers can't draw it). */
  preview: string | null;
  status: Status;
  /** 0–1 while uploading. */
  progress: number;
  error: string | null;
};

type Props = {
  tripId: string;
  /** Attach every upload to this activity (used on the activity's page). */
  activityId?: string;
  /** Or to this accommodation (used on its page). */
  accommodationId?: string;
  /** Or to this transportation leg (used on its page). */
  transportationId?: string;
  /** Otherwise, let the user pick what to attach it to (optional). */
  targets?: AttachTarget[];
  defaultType?: DocumentType;
  title?: string;
};

const DRAWABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Adding documents, one or several at a time:
 * 1. Pick or drop files; each is checked (type, size) here for instant
 *    feedback, and images get a local preview (no upload needed for that).
 * 2. On "Subir", files go one after another from the browser straight to
 *    Storage (uploadTripFile), with a progress bar and a Cancelar button.
 * 3. After each upload, a Server Action records its metadata (registerFile),
 *    which re-checks everything and deletes the upload if it can't be saved.
 * Type and attachment apply to the whole batch.
 */
export function UploadForm({
  tripId,
  activityId,
  accommodationId,
  transportationId,
  targets,
  defaultType = "ticket",
  title = "Subir documentos",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>(defaultType);
  // "kind:id" of the picked target, or "" for a trip-level document.
  const [attachTo, setAttachTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The upload in flight, so Cancelar can stop it.
  const aborter = useRef<{ key: string; controller: AbortController } | null>(null);

  // Object URLs hold the file in memory until revoked: free them when the form goes away.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
      aborter.current?.controller.abort();
    },
    [],
  );

  const update = (key: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  function add(files: FileList | File[]) {
    setNotice(null);
    const picked = Array.from(files);
    const room = MAX_FILES - items.length;
    if (picked.length > room) setNotice(`Puedes subir hasta ${MAX_FILES} archivos a la vez.`);
    const next = picked.slice(0, Math.max(0, room)).map((file): Item => {
      const problem = validateFile(file);
      const type = mimeTypeOf(file);
      return {
        key: crypto.randomUUID(),
        file,
        preview: !problem && type && DRAWABLE.has(type) ? URL.createObjectURL(file) : null,
        status: problem ? "error" : "ready",
        progress: 0,
        error: problem,
      };
    });
    setItems((list) => [...list, ...next]);
    // Reset the input so picking the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(key: string) {
    const item = items.find((i) => i.key === key);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setItems((list) => list.filter((i) => i.key !== key));
  }

  function cancel(key: string) {
    if (aborter.current?.key === key) aborter.current.controller.abort();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const queue = items.filter((i) => i.status === "ready");
    if (queue.length === 0) return;
    setBusy(true);
    setNotice(null);
    // A fixed parent (the page's own) wins; otherwise the optional pick.
    const parent = activityId || accommodationId || transportationId ? { activityId, accommodationId, transportationId } : parseTarget(attachTo);

    let done = 0;
    for (const item of queue) {
      const controller = new AbortController();
      aborter.current = { key: item.key, controller };
      update(item.key, { status: "uploading", progress: 0, error: null });

      const upload = await uploadTripFile(tripId, item.file, {
        signal: controller.signal,
        onProgress: (progress) => update(item.key, { progress }),
      });
      aborter.current = null;
      if ("cancelled" in upload) {
        if (item.preview) URL.revokeObjectURL(item.preview);
        setItems((list) => list.filter((i) => i.key !== item.key));
        continue;
      }
      if ("error" in upload) {
        update(item.key, { status: "error", error: upload.error });
        continue;
      }

      update(item.key, { status: "saving" });
      const result = await registerFile(tripId, {
        fileId: upload.fileId,
        path: upload.path,
        originalName: item.file.name,
        documentType,
        ...parent,
      });
      if (result.error) {
        update(item.key, { status: "error", error: result.error });
        continue;
      }
      // Saved: it now shows in the page's list (registerFile refreshes it).
      done += 1;
      if (item.preview) URL.revokeObjectURL(item.preview);
      setItems((list) => list.filter((i) => i.key !== item.key));
    }

    setBusy(false);
    if (done > 0) setNotice(done === 1 ? "Documento subido." : `${done} documentos subidos.`);
  }

  const ready = items.filter((i) => i.status === "ready").length;
  const current = items.find((i) => i.status === "uploading" || i.status === "saving");

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-busy={busy}>
      <h2 className="font-semibold">{title}</h2>

      <input
        ref={inputRef}
        id={`${ids}-file`}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => e.target.files && add(e.target.files)}
      />
      {/*
        Drag and drop: the browser only allows a drop where dragover is
        cancelled (preventDefault). dragleave also fires when moving over a
        child, so only leaving the zone itself (relatedTarget outside) counts.
      */}
      <label
        htmlFor={`${ids}-file`}
        onDragEnter={(e) => {
          if (!busy && e.dataTransfer.types.includes("Files")) setDragging(true);
        }}
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && e.dataTransfer.files.length > 0) add(e.dataTransfer.files);
        }}
        className={
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-within:ring-3 focus-within:ring-ring/50 lg:min-h-32 " +
          (dragging ? "border-primary bg-secondary" : "border-primary/30 bg-secondary/50 hover:border-primary/60") +
          (busy ? " pointer-events-none opacity-60" : "")
        }
      >
        <FileUp className="size-6 text-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-primary">
          {dragging ? "Suelta para agregar" : items.length > 0 ? "Agregar más archivos" : "Elegir archivos"}
        </span>
        <span className="hidden text-xs text-muted-foreground lg:block">o arrástralos aquí</span>
        <span className="text-xs text-muted-foreground">PDF o imagen (JPG, PNG, WebP, HEIC) · máx. 10 MB c/u</span>
      </label>

      {items.length > 0 && (
        <ul aria-label="Archivos por subir" className="flex flex-col gap-2">
          {items.map((item) => {
            const active = item.status === "uploading" || item.status === "saving";
            const percent = Math.round(item.progress * 100);
            return (
              <li
                key={item.key}
                className={"flex flex-col gap-2 rounded-xl p-3 " + (item.status === "error" ? "bg-destructive/10" : "bg-secondary")}
              >
                <div className="flex items-center gap-3">
                  {item.preview ? (
                    // Local preview from an object URL: nothing is uploaded to show it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.preview} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-card text-primary" aria-hidden="true">
                      {item.status === "error" ? <AlertCircle className="size-5 text-destructive" /> : <FileText className="size-5" />}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(item.file.size)}
                      {item.status === "uploading" ? ` · subiendo ${percent}%` : item.status === "saving" ? " · guardando…" : ""}
                    </span>
                  </span>
                  {item.status === "uploading" ? (
                    <Button type="button" variant="ghost" className="h-11 shrink-0" onClick={() => cancel(item.key)}>
                      Cancelar
                    </Button>
                  ) : item.status === "saving" ? (
                    <Loader2 className="mx-3 size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 shrink-0"
                      disabled={busy}
                      aria-label={`Quitar ${item.file.name}`}
                      onClick={() => remove(item.key)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {active && (
                  <div
                    role="progressbar"
                    aria-label={`Subiendo ${item.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-1.5 overflow-hidden rounded-full bg-card"
                  >
                    <div
                      className={"h-full rounded-full transition-[width] duration-200 " + (item.status === "saving" ? "bg-success" : "bg-primary")}
                      style={{ width: `${item.status === "saving" ? 100 : percent}%` }}
                    />
                  </div>
                )}
                {item.error && (
                  <p role="alert" className="text-xs text-destructive">
                    {item.error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
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

      {!activityId && !accommodationId && !transportationId && targets && targets.length > 0 && (
        <TargetSelect
          id={`${ids}-target`}
          label="Adjuntar a (opcional)"
          targets={targets}
          value={attachTo}
          onChange={setAttachTo}
          disabled={busy}
        />
      )}

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

      <Button type="submit" size="lg" className="h-11" disabled={ready === 0 || busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
        {busy ? "Subiendo…" : ready > 1 ? `Subir ${ready} archivos` : "Subir"}
      </Button>
      <p className="sr-only" aria-live="polite">
        {current ? (current.status === "saving" ? `Guardando ${current.file.name}` : `Subiendo ${current.file.name}`) : (notice ?? "")}
      </p>
    </form>
  );
}
