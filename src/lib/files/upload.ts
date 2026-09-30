import { createClient } from "@/lib/supabase/client";

import { FILES_BUCKET, mimeTypeOf, newFilePath, validateFile } from "./rules";

export type UploadedFile = { fileId: string; path: string };
export type UploadResult = UploadedFile | { error: string } | { cancelled: true };

type Options = {
  /** Called as bytes go out, with a fraction from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Aborting it cancels the upload (the "Cancelar" button). */
  signal?: AbortSignal;
};

/**
 * Step 1 of adding a document: upload the bytes straight from the browser to
 * Supabase Storage. The file never passes through our Next.js server, so its
 * size doesn't count against server action limits and we don't pay twice for
 * the bandwidth.
 *
 * Who checks what:
 *   - validateFile (here): quick feedback, but a user can bypass it.
 *   - The bucket: rejects anything over 10 MB or of another type.
 *   - Storage RLS: the path starts with the trip id, and the insert policy
 *     only lets editors of that trip upload there.
 *
 * The file id is generated here so it can be part of the path; the server
 * action (registerFile) then creates the files row with that same id.
 *
 * Why XMLHttpRequest and not `supabase.storage.upload()`: supabase-js uses
 * fetch, and fetch can't report how much of the request body has been sent.
 * XHR can (`xhr.upload.onprogress`), which is what drives the progress bar.
 * The request is the same one supabase-js makes: POST
 * /storage/v1/object/{bucket}/{path} with the user's access token, so Storage
 * applies the same RLS policies.
 */
export async function uploadTripFile(tripId: string, file: File, { onProgress, signal }: Options = {}): Promise<UploadResult> {
  const problem = validateFile(file);
  const type = mimeTypeOf(file);
  if (problem || !type) return { error: problem ?? "Tipo de archivo no permitido." };

  // The signed-in user's JWT: Storage reads the user from it for RLS
  // (auth.uid() in the policies). getSession refreshes it if it expired.
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  if (signal?.aborted) return { cancelled: true };

  const fileId = crypto.randomUUID();
  // Only ASCII letters, digits, "-", "." and "/" (see newFilePath): no URL encoding needed.
  const path = newFilePath(tripId, fileId, file.name, type);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${FILES_BUCKET}/${path}`;

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    xhr.setRequestHeader("x-upsert", "false"); // never overwrite: a new version is a new file
    // Sent as the raw body, so the type we checked is the one stored (the
    // browser may report "" for HEIC; see mimeTypeOf).
    xhr.setRequestHeader("Content-Type", type);
    xhr.setRequestHeader("Cache-Control", "max-age=3600");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve({ fileId, path });
      } else {
        console.error("File upload failed", xhr.status, xhr.responseText);
        resolve({ error: describeStorageError(xhr.status, xhr.responseText) });
      }
    };
    xhr.onerror = () => resolve({ error: "No pudimos subir el archivo. Revisa tu conexión e inténtalo de nuevo." });
    xhr.onabort = () => {
      // Cancelled at the very end, Storage may have stored it before we
      // stopped listening; without a files row nobody could see or delete
      // it, so remove it just in case (nothing happens if it isn't there).
      void supabase.storage.from(FILES_BUCKET).remove([path]);
      resolve({ cancelled: true });
    };
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(file);
  });
}

/** Storage's error responses, in words a traveler understands. */
function describeStorageError(status: number, body: string) {
  let message = "";
  try {
    message = String((JSON.parse(body) as { message?: unknown }).message ?? "");
  } catch {
    // Not JSON (a proxy error page, say): fall back on the status.
  }
  if (status === 413 || /too large|exceeded the maximum/i.test(message)) return "El archivo pesa más de 10 MB. Elige uno más ligero.";
  if (status === 415 || /mime type/i.test(message)) return "Sube un PDF o una imagen (JPG, PNG, WebP o HEIC).";
  if (status === 401 || status === 403 || /row-level security/i.test(message)) return "No tienes permiso para subir archivos a este viaje.";
  return "No pudimos subir el archivo. Inténtalo de nuevo.";
}
