"use server";

import { refresh } from "next/cache";

import { FILES_BUCKET, isDocumentType, isFilePathFor, isFileType, MAX_FILE_BYTES, normalizeFileName } from "@/lib/files/rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type FileActionResult = { error?: string };

type RegisterInput = {
  fileId: string;
  path: string;
  originalName: string;
  documentType: string;
  activityId?: string | null;
  accommodationId?: string | null;
};

/**
 * Step 2 of adding a document. Step 1 already happened in the browser: the
 * bytes were uploaded to Storage (uploadTripFile). Here we record the metadata.
 *
 * Everything in `input` comes from the browser and can be tampered with, so:
 *   - The path must have the exact shape we generate, inside this trip and
 *     this file id's folder (the database checks the same with a constraint).
 *   - Size and type are NOT taken from the browser: we ask Storage what it
 *     actually stored. The browser could claim "1 KB PDF" for anything.
 *   - RLS decides whether this user may add files to this trip at all.
 *
 * If the row can't be saved we delete the uploaded object, so no file is left
 * in Storage with nothing pointing at it.
 */
export async function registerFile(tripId: string, input: RegisterInput): Promise<FileActionResult> {
  const name = input.originalName.trim().slice(0, 255);
  const activityId = input.activityId || null;
  const accommodationId = input.accommodationId || null;
  if (
    !isUuid(tripId) ||
    !isUuid(input.fileId) ||
    !isFilePathFor(input.path, tripId, input.fileId) ||
    !isDocumentType(input.documentType) ||
    (activityId !== null && !isUuid(activityId)) ||
    (accommodationId !== null && !isUuid(accommodationId)) ||
    (activityId !== null && accommodationId !== null) ||
    name.length === 0
  ) {
    return { error: "El archivo no es válido." };
  }

  const supabase = await createClient();
  const storage = supabase.storage.from(FILES_BUCKET);
  const discard = async () => {
    const { error } = await storage.remove([input.path]);
    if (error) console.error("Could not delete unregistered upload", input.path, error);
  };

  // What Storage really has. Reading it also requires the bucket's select
  // policy, so a non-member can't get this far.
  const { data: info, error: infoError } = await storage.info(input.path);
  if (infoError || !info?.size || !info.contentType || !isFileType(info.contentType) || info.size > MAX_FILE_BYTES) {
    if (infoError) console.error("registerFile: storage info failed", infoError);
    await discard();
    return { error: "No encontramos el archivo subido. Inténtalo de nuevo." };
  }

  const { error } = await supabase.from("files").insert({
    id: input.fileId,
    trip_id: tripId,
    storage_path: input.path,
    original_name: name,
    mime_type: info.contentType,
    size_bytes: info.size,
    document_type: input.documentType,
    activity_id: activityId,
    accommodation_id: accommodationId,
  });

  if (error) {
    console.error("registerFile failed", error);
    await discard();
    // 42501: RLS said no. 23503: the activity isn't in this trip.
    return {
      error:
        error.code === "42501"
          ? "No tienes permiso para subir archivos a este viaje."
          : error.code === "23503"
            ? "La actividad o el hospedaje elegido no es de este viaje."
            : "No pudimos guardar el archivo. Inténtalo de nuevo.",
    };
  }

  refresh();
  return {};
}

/**
 * Renames a document. Only the name shown in Travio and used for downloads
 * changes; the object in Storage keeps its path, so nothing is copied or moved.
 * The extension is kept from the current name (normalizeFileName).
 */
export async function renameFile(tripId: string, fileId: string, name: string): Promise<FileActionResult> {
  if (!isUuid(tripId) || !isUuid(fileId)) return { error: "Este archivo no existe." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("files")
    .select("original_name, mime_type")
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .maybeSingle();
  if (!current) return { error: "Este archivo no existe." };

  const cleaned = normalizeFileName(name, current.mime_type, current.original_name);
  if (!cleaned) return { error: "Escribe un nombre." };

  const { data, error } = await supabase
    .from("files")
    .update({ original_name: cleaned })
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .select("id");

  if (error) {
    console.error("renameFile failed", error);
    return { error: "No pudimos cambiar el nombre. Inténtalo de nuevo." };
  }
  // Viewers can read the row but RLS blocks the update: zero rows.
  if (data.length === 0) return { error: "No tienes permiso para editar este archivo." };

  refresh();
  return {};
}

/**
 * Deletes the files row first, then the object.
 *
 * Why this order: if the row goes and the object removal fails, we're left with
 * an unreachable object (wasted space, nobody can list or open it). The other
 * order could leave a row pointing at nothing, which the UI would show as a
 * broken document.
 */
export async function deleteFile(tripId: string, fileId: string): Promise<FileActionResult> {
  if (!isUuid(tripId) || !isUuid(fileId)) return { error: "Este archivo no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .delete()
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .select("storage_path");

  if (error) {
    console.error("deleteFile failed", error);
    return { error: "No pudimos borrar el archivo. Inténtalo de nuevo." };
  }
  // RLS blocks silently: zero rows means not found or not allowed.
  if (data.length === 0) return { error: "No tienes permiso para borrar este archivo." };

  const { error: removeError } = await supabase.storage.from(FILES_BUCKET).remove([data[0].storage_path]);
  if (removeError) console.error("Could not delete stored file", data[0].storage_path, removeError);

  refresh();
  return {};
}
