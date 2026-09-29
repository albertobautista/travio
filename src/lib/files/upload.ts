import { createClient } from "@/lib/supabase/client";

import { FILES_BUCKET, mimeTypeOf, newFilePath, validateFile } from "./rules";

export type UploadedFile = { fileId: string; path: string };

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
 */
export async function uploadTripFile(tripId: string, file: File): Promise<UploadedFile | { error: string }> {
  const problem = validateFile(file);
  const type = mimeTypeOf(file);
  if (problem || !type) return { error: problem ?? "Tipo de archivo no permitido." };

  const fileId = crypto.randomUUID();
  const path = newFilePath(tripId, fileId, file.name, type);

  const { error } = await createClient().storage.from(FILES_BUCKET).upload(path, file, {
    contentType: type,
    upsert: false, // never overwrite: a new version is a new file
  });

  if (error) {
    console.error("File upload failed", error);
    return { error: "No pudimos subir el archivo. Revisa tu conexión e inténtalo de nuevo." };
  }
  return { fileId, path };
}
