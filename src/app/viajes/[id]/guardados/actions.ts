"use server";

import { redirect } from "next/navigation";

import { parseSavedPlaceForm, type SavedPlaceFormState } from "@/lib/saved-places/saved-place-form";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Ids arrive via .bind() and can be tampered with; RLS decides what the user
// may change. Blocked writes return zero rows, so every write asks for them.

async function stopIdsOf(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("trip_stops").select("id").eq("trip_id", tripId);
  return (data ?? []).map((s) => s.id);
}

const listUrl = (tripId: string) => `/viajes/${tripId}/guardados`;

export async function createSavedPlace(
  tripId: string,
  _prev: SavedPlaceFormState,
  formData: FormData,
): Promise<SavedPlaceFormState> {
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  const parsed = parseSavedPlaceForm(formData, { stopIds: await stopIdsOf(tripId) });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .insert({ ...parsed.data, trip_id: tripId })
    .select("id");

  if (error || data.length === 0) {
    if (error) console.error("createSavedPlace failed", error);
    const denied = !error || error.code === "42501";
    return {
      error: denied ? "No tienes permiso para editar este viaje." : "No pudimos guardar el lugar. Inténtalo de nuevo.",
      values: parsed.values,
    };
  }
  redirect(listUrl(tripId));
}

export async function updateSavedPlace(
  tripId: string,
  placeId: string,
  _prev: SavedPlaceFormState,
  formData: FormData,
): Promise<SavedPlaceFormState> {
  if (!isUuid(tripId) || !isUuid(placeId)) return { error: "Este lugar no existe." };
  const parsed = parseSavedPlaceForm(formData, { stopIds: await stopIdsOf(tripId) });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_places")
    .update(parsed.data)
    .eq("trip_id", tripId)
    .eq("id", placeId)
    .select("id");

  if (error) {
    console.error("updateSavedPlace failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };
  redirect(listUrl(tripId));
}

export type DeleteSavedPlaceState = { error?: string } | undefined;

/** Activities planned from it stay in the itinerary (saved_place_id is set to null). */
export async function deleteSavedPlace(tripId: string, placeId: string): Promise<DeleteSavedPlaceState> {
  if (!isUuid(tripId) || !isUuid(placeId)) return { error: "Este lugar no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_places").delete().eq("trip_id", tripId).eq("id", placeId).select("id");
  if (error) {
    console.error("deleteSavedPlace failed", error);
    return { error: "No pudimos borrar el lugar. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };
  redirect(listUrl(tripId));
}
