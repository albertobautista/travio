"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseStopForm, type StopFormState } from "@/lib/trips/stop-form";
import { isUuid } from "@/lib/uuid";

// Trip and stop ids arrive via .bind() and can be tampered with; RLS decides
// what the user may change. As with trips, a write blocked by RLS returns zero
// rows instead of an error, so every write asks for the affected rows back.

async function getTripDates(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("trips").select("start_date, end_date").eq("id", tripId).maybeSingle();
  return data;
}

export async function createStop(tripId: string, _prev: StopFormState, formData: FormData): Promise<StopFormState> {
  const trip = isUuid(tripId) ? await getTripDates(tripId) : null;
  if (!trip) return { error: "Este viaje no existe." };

  const parsed = parseStopForm(formData, trip);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  // position is left out: a trigger appends the stop at the end of the route.
  const { data, error } = await supabase
    .from("trip_stops")
    .insert({ ...parsed.data, trip_id: tripId })
    .select("id");

  if (error) {
    console.error("createStop failed", error);
    const denied = error.code === "42501";
    return {
      error: denied ? "No tienes permiso para editar este viaje." : "No pudimos agregar la ciudad. Inténtalo de nuevo.",
      values: parsed.values,
    };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  redirect(`/viajes/${tripId}`);
}

export async function updateStop(
  tripId: string,
  stopId: string,
  _prev: StopFormState,
  formData: FormData,
): Promise<StopFormState> {
  const trip = isUuid(tripId) && isUuid(stopId) ? await getTripDates(tripId) : null;
  if (!trip) return { error: "Este viaje no existe." };

  const parsed = parseStopForm(formData, trip);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_stops")
    .update(parsed.data)
    .eq("id", stopId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("updateStop failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  redirect(`/viajes/${tripId}`);
}

export type DeleteStopState = { error?: string } | undefined;

export async function deleteStop(tripId: string, stopId: string): Promise<DeleteStopState> {
  if (!isUuid(tripId) || !isUuid(stopId)) return { error: "Esta ciudad no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_stops")
    .delete()
    .eq("id", stopId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("deleteStop failed", error);
    return { error: "No pudimos quitar la ciudad. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  redirect(`/viajes/${tripId}`);
}

/** Form action for the ↑/↓ buttons in the route list. Works without JavaScript. */
export async function moveStop(stopId: string, direction: -1 | 1) {
  if (!isUuid(stopId) || (direction !== -1 && direction !== 1)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_trip_stop", { p_stop_id: stopId, p_direction: direction });
  // "Stop not found" also covers viewers: the function can't lock a row they
  // may not update. Nothing to show; the list simply doesn't change.
  if (error) console.error("moveStop failed", error);

  refresh();
}

/**
 * Remembers the Google place a city resolved to (found by name the first time
 * its photo is shown), so later views skip the text search, the costly call.
 * Only fills an empty value: it never overwrites a place someone chose.
 * Viewers can't write (RLS), and that's fine: their views just search again.
 */
export async function rememberStopPlace(tripId: string, stopId: string, placeId: string) {
  if (!isUuid(tripId) || !isUuid(stopId) || !/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_stops")
    .update({ google_place_id: placeId })
    .eq("trip_id", tripId)
    .eq("id", stopId)
    .is("google_place_id", null);
  if (error) console.error("rememberStopPlace failed", error);
}
