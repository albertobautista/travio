"use server";

import { refresh } from "next/cache";

import { FILES_BUCKET, isDocumentType, isFilePathFor, isFileType, MAX_FILE_BYTES, normalizeFileName } from "@/lib/files/rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

import type { AttachIds } from "./targets";

export type FileActionResult = { error?: string };

type RegisterInput = AttachIds & {
  fileId: string;
  path: string;
  originalName: string;
  documentType: string;
};

/**
 * The parent columns for a file, from ids sent by the browser: each must be a
 * uuid and at most one may be set. Whether the parent exists and belongs to
 * the same trip is checked by the database (composite foreign keys).
 */
function parentColumns(ids: AttachIds) {
  const columns = {
    activity_id: ids.activityId || null,
    accommodation_id: ids.accommodationId || null,
    transportation_id: ids.transportationId || null,
  };
  const set = Object.values(columns).filter((v) => v !== null);
  return set.length <= 1 && set.every(isUuid) ? columns : null;
}

/** 42501: RLS said no. 23503: the parent isn't in this trip (or was deleted). */
function describeWriteError(code: string | undefined, fallback: string) {
  if (code === "42501") return "No tienes permiso para editar los archivos de este viaje.";
  if (code === "23503") return "Lo que elegiste para adjuntar ya no existe o no es de este viaje.";
  return fallback;
}

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
  const parents = parentColumns(input);
  if (
    !isUuid(tripId) ||
    !isUuid(input.fileId) ||
    !isFilePathFor(input.path, tripId, input.fileId) ||
    !isDocumentType(input.documentType) ||
    !parents ||
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
    ...parents,
  });

  if (error) {
    console.error("registerFile failed", error);
    await discard();
    return { error: describeWriteError(error.code, "No pudimos guardar el archivo. Inténtalo de nuevo.") };
  }

  refresh();
  return {};
}

/**
 * Edits a document's metadata: its name and what it's attached to.
 *
 * Only the database row changes. The object in Storage keeps its path
 * ({trip}/{file}/{name}), which doesn't depend on the parent or the display
 * name, so nothing is copied or moved. The extension is kept from the current
 * name (normalizeFileName) so downloads still open in the right app.
 */
export async function updateFile(
  tripId: string,
  fileId: string,
  input: AttachIds & { name: string },
): Promise<FileActionResult> {
  const parents = parentColumns(input);
  if (!isUuid(tripId) || !isUuid(fileId) || !parents) return { error: "Este archivo no existe." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("files")
    .select("original_name, mime_type")
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .maybeSingle();
  if (!current) return { error: "Este archivo no existe." };

  const cleaned = normalizeFileName(input.name, current.mime_type, current.original_name);
  if (!cleaned) return { error: "Escribe un nombre." };

  const { data, error } = await supabase
    .from("files")
    .update({ original_name: cleaned, ...parents })
    .eq("trip_id", tripId)
    .eq("id", fileId)
    .select("id");

  if (error) {
    console.error("updateFile failed", error);
    return { error: describeWriteError(error.code, "No pudimos guardar los cambios. Inténtalo de nuevo.") };
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
