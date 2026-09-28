"use server";

import { refresh } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { COVERS_BUCKET, isCoverPathForTrip } from "@/lib/trips/covers";
import { isUuid } from "@/lib/uuid";

export type CoverActionResult = { error?: string };

/**
 * Step 2 of changing a cover. Step 1 already happened in the browser: the file
 * was uploaded straight to Storage (the bucket's insert policy checked that the
 * user can edit this trip). Here we point the trip at the new file and delete
 * the previous one.
 */
export async function setTripCover(tripId: string, path: string): Promise<CoverActionResult> {
  // Both values come from the browser. The path must be a cover inside this
  // trip's folder; the database enforces the same rule with a check constraint.
  if (!isUuid(tripId) || !isCoverPathForTrip(path, tripId)) {
    return { error: "El archivo no es válido." };
  }

  const supabase = await createClient();
  const storage = supabase.storage.from(COVERS_BUCKET);

  const { data: current } = await supabase.from("trips").select("cover_image_path").eq("id", tripId).maybeSingle();

  const { data, error } = await supabase
    .from("trips")
    .update({ cover_image_path: path })
    .eq("id", tripId)
    .select("id");

  if (error || data.length === 0) {
    if (error) console.error("setTripCover failed", error);
    // Don't leave the uploaded file behind with nothing pointing at it.
    await storage.remove([path]);
    return { error: error ? "No pudimos guardar la portada. Inténtalo de nuevo." : "No tienes permiso para editar este viaje." };
  }

  const previous = current?.cover_image_path;
  if (previous && previous !== path) {
    const { error: removeError } = await storage.remove([previous]);
    // The new cover is saved; a leftover old file is only wasted space.
    if (removeError) console.error("Could not delete previous cover", previous, removeError);
  }

  refresh();
  return {};
}

export async function removeTripCover(tripId: string): Promise<CoverActionResult> {
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("trips").select("cover_image_path").eq("id", tripId).maybeSingle();

  const { data, error } = await supabase
    .from("trips")
    .update({ cover_image_path: null })
    .eq("id", tripId)
    .select("id");

  if (error) {
    console.error("removeTripCover failed", error);
    return { error: "No pudimos quitar la portada. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  if (current?.cover_image_path) {
    const { error: removeError } = await supabase.storage.from(COVERS_BUCKET).remove([current.cover_image_path]);
    if (removeError) console.error("Could not delete cover", current.cover_image_path, removeError);
  }

  refresh();
  return {};
}
