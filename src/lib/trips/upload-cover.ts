import { createClient } from "@/lib/supabase/client";

import { COVERS_BUCKET, isCoverType, newCoverPath, validateCoverFile } from "./covers";

/**
 * Uploads a cover straight from the browser to Supabase Storage (the file never
 * passes through our Next.js server). The bucket's insert policy only lets it
 * through if the user can edit `tripId`, so the trip must already exist.
 *
 * Returns the storage path; saving it on the trip is a separate step
 * (setTripCover), which also deletes the previous cover.
 */
export async function uploadCoverFile(tripId: string, file: File): Promise<{ path: string } | { error: string }> {
  const problem = validateCoverFile(file);
  if (problem || !isCoverType(file.type)) {
    return { error: problem ?? "Usa una imagen JPG, PNG o WebP." };
  }

  const path = newCoverPath(tripId, file.type);
  const { error } = await createClient().storage.from(COVERS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false, // never overwrite; every cover gets a new name
    cacheControl: "3600",
  });

  if (error) {
    console.error("Cover upload failed", error);
    return { error: "No pudimos subir la imagen. Revisa tu conexión e inténtalo de nuevo." };
  }
  return { path };
}
