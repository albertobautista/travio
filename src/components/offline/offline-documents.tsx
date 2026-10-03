"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CloudDownload, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/files/rules";
import { removeDocuments, saveDocument, savedDocumentIds } from "@/lib/offline/storage";

type File = { id: string; name: string; size: number };

type Status =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "idle"; saved: Set<string> }
  | { kind: "downloading"; done: number; total: number }
  | { kind: "error"; saved: Set<string>; failed: number };

/**
 * "Disponible sin conexión" on the Documentos page. Opt-in on purpose: the
 * files are copied to this device as they are (not encrypted), so the user
 * decides. They're deleted on sign out, and when access to the trip ends.
 *
 * Saved files open from the same links as always: the service worker answers
 * /viajes/{trip}/documentos/{file} from the device (public/sw.js).
 */
export function OfflineDocuments({ tripId, files }: { tripId: string; files: File[] }) {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const ids = files.map((f) => f.id).join(",");

  const refresh = useCallback(async () => {
    // Without a service worker nothing would serve the copies (or it's development).
    if (!("caches" in window) || !navigator.serviceWorker?.controller) {
      setStatus({ kind: "unsupported" });
      return;
    }
    setStatus({ kind: "idle", saved: await savedDocumentIds(tripId, ids.split(",").filter(Boolean)) });
  }, [tripId, ids]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the device's storage once on mount
    void refresh();
  }, [refresh]);

  if (status.kind === "checking" || status.kind === "unsupported" || files.length === 0) return null;

  const saved = status.kind === "idle" || status.kind === "error" ? status.saved : new Set<string>();
  const missing = files.filter((f) => !saved.has(f.id));
  const allSaved = missing.length === 0;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  async function download(list: File[]) {
    // Ask the browser not to evict these copies when space runs low (iPhone
    // especially). It may say no; the download still works.
    await navigator.storage?.persist?.().catch(() => false);
    let failed = 0;
    for (const [i, file] of list.entries()) {
      setStatus({ kind: "downloading", done: i, total: list.length });
      try {
        await saveDocument(tripId, file);
      } catch (error) {
        console.error("saveDocument failed", file.id, error);
        failed++;
      }
    }
    const nowSaved = await savedDocumentIds(tripId, files.map((f) => f.id));
    setStatus(failed > 0 ? { kind: "error", saved: nowSaved, failed } : { kind: "idle", saved: nowSaved });
  }

  async function updateAll() {
    await removeDocuments(tripId, files.map((f) => f.id));
    await download(files);
  }

  async function removeAll() {
    await removeDocuments(tripId, files.map((f) => f.id));
    await refresh();
  }

  return (
    <section aria-labelledby="offline-docs" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-xl " +
            (allSaved ? "bg-success-soft text-success-foreground" : "bg-secondary text-primary")
          }
        >
          {allSaved ? <CheckCircle2 className="size-5" /> : <CloudDownload className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="offline-docs" className="font-semibold">
            {allSaved ? "Disponibles sin conexión" : "Tenlos sin conexión"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {allSaved
              ? `${files.length === 1 ? "El documento está guardado" : `Los ${files.length} documentos están guardados`} en este dispositivo. Se borran al cerrar sesión.`
              : saved.size > 0
                ? `${saved.size} de ${files.length} guardados en este dispositivo. Descarga el resto para abrirlos sin internet.`
                : "Guárdalos en este dispositivo para abrir boletos y reservas sin internet. Quedan sin cifrar en el teléfono y se borran al cerrar sesión."}
          </p>
        </div>
      </div>

      {status.kind === "downloading" ? (
        <div className="flex flex-col gap-2" role="status">
          <span className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            Descargando {status.done + 1} de {status.total}…
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${(status.done / status.total) * 100}%` }} />
          </span>
        </div>
      ) : allSaved ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={updateAll}>
            <RefreshCw aria-hidden="true" />
            Actualizar
          </Button>
          <Button variant="ghost" className="h-11 flex-1 text-destructive hover:text-destructive" onClick={removeAll}>
            <Trash2 aria-hidden="true" />
            Quitar del dispositivo
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={() => download(missing)}>
          <CloudDownload aria-hidden="true" />
          {saved.size > 0
            ? `Descargar ${missing.length} restantes`
            : `Descargar para el viaje · ${formatFileSize(totalSize)}`}
        </Button>
      )}

      {status.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {status.failed === 1 ? "Un documento no se pudo descargar." : `${status.failed} documentos no se pudieron descargar.`} Inténtalo
          de nuevo con mejor conexión.
        </p>
      )}
    </section>
  );
}
