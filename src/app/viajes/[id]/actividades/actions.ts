"use server";

import { redirect } from "next/navigation";

import { parseActivityForm, type ActivityFormState } from "@/lib/activities/activity-form";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Ids arrive via .bind() and can be tampered with; RLS decides what the user
// may change. Blocked writes return zero rows, so every write asks for them.

/** What the form parser needs from the database: trip dates/currency and the stops' time zones. */
async function loadContext(tripId: string) {
  const supabase = await createClient();
  const [{ data: trip }, { data: stops }] = await Promise.all([
    supabase.from("trips").select("start_date, end_date, currency").eq("id", tripId).maybeSingle(),
    supabase.from("trip_stops").select("id, timezone").eq("trip_id", tripId),
  ]);
  return trip ? { trip, stops: stops ?? [] } : null;
}

const itineraryUrl = (tripId: string, date: string) => `/viajes/${tripId}/itinerario?dia=${date}`;

export async function createActivity(
  tripId: string,
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = isUuid(tripId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Este viaje no existe." };

  const parsed = parseActivityForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({ ...parsed.data, trip_id: tripId })
    .select("id");

  if (error) {
    console.error("createActivity failed", error);
    const denied = error.code === "42501";
    return {
      error: denied ? "No tienes permiso para editar este viaje." : "No pudimos guardar la actividad. Inténtalo de nuevo.",
      values: parsed.values,
    };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  redirect(itineraryUrl(tripId, parsed.values.date));
}

export async function updateActivity(
  tripId: string,
  activityId: string,
  _prev: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = isUuid(tripId) && isUuid(activityId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Esta actividad no existe." };

  const parsed = parseActivityForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update(parsed.data)
    .eq("id", activityId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("updateActivity failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  redirect(itineraryUrl(tripId, parsed.values.date));
}

export type DeleteActivityState = { error?: string } | undefined;

/** `returnDate` is only used to go back to the same day in the itinerary. */
export async function deleteActivity(tripId: string, activityId: string, returnDate: string): Promise<DeleteActivityState> {
  if (!isUuid(tripId) || !isUuid(activityId)) return { error: "Esta actividad no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("deleteActivity failed", error);
    return { error: "No pudimos borrar la actividad. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  redirect(/^\d{4}-\d{2}-\d{2}$/.test(returnDate) ? itineraryUrl(tripId, returnDate) : `/viajes/${tripId}/itinerario`);
}
