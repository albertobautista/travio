"use server";

import { redirect } from "next/navigation";

import { parseAccommodationForm, type AccommodationFormState } from "@/lib/accommodations/accommodation-form";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Ids arrive via .bind() and can be tampered with; RLS decides what the user
// may change. Blocked writes return zero rows, so every write asks for them.

async function loadContext(tripId: string) {
  const supabase = await createClient();
  const [{ data: trip }, { data: stops }, { data: travelers }] = await Promise.all([
    supabase.from("trips").select("start_date, end_date, currency").eq("id", tripId).maybeSingle(),
    supabase.from("trip_stops").select("id, timezone").eq("trip_id", tripId),
    supabase.from("travelers").select("id").eq("trip_id", tripId),
  ]);
  return trip ? { trip, stops: stops ?? [], travelerIds: (travelers ?? []).map((t) => t.id) } : null;
}

/**
 * Saved after the accommodation row exists. If it fails the stay is already
 * saved, so we open it with a notice instead of returning to the form (a
 * resubmit would create a duplicate).
 */
async function saveParticipants(tripId: string, accommodationId: string, participantIds: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_accommodation_participants", {
    p_accommodation_id: accommodationId,
    p_traveler_ids: participantIds,
  });
  if (error) {
    console.error("set_accommodation_participants failed", error);
    redirect(`/viajes/${tripId}/hospedajes/${accommodationId}?participantes=error`);
  }
}

const listUrl = (tripId: string) => `/viajes/${tripId}/hospedajes`;

export async function createAccommodation(
  tripId: string,
  _prev: AccommodationFormState,
  formData: FormData,
): Promise<AccommodationFormState> {
  const context = isUuid(tripId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Este viaje no existe." };

  const parsed = parseAccommodationForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accommodations")
    .insert({ ...parsed.data, trip_id: tripId })
    .select("id");

  if (error) {
    console.error("createAccommodation failed", error);
    const denied = error.code === "42501";
    return {
      error: denied ? "No tienes permiso para editar este viaje." : "No pudimos guardar el hospedaje. Inténtalo de nuevo.",
      values: parsed.values,
    };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  await saveParticipants(tripId, data[0].id, parsed.participantIds);
  // Straight to the new stay, where the reservation can be attached.
  redirect(`/viajes/${tripId}/hospedajes/${data[0].id}?nuevo=1`);
}

export async function updateAccommodation(
  tripId: string,
  accommodationId: string,
  _prev: AccommodationFormState,
  formData: FormData,
): Promise<AccommodationFormState> {
  const context = isUuid(tripId) && isUuid(accommodationId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Este hospedaje no existe." };

  const parsed = parseAccommodationForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accommodations")
    .update(parsed.data)
    .eq("id", accommodationId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("updateAccommodation failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  await saveParticipants(tripId, accommodationId, parsed.participantIds);
  redirect(listUrl(tripId));
}

export type DeleteAccommodationState = { error?: string } | undefined;

/** Its files stay as trip documents (files.accommodation_id is set to null). */
export async function deleteAccommodation(tripId: string, accommodationId: string): Promise<DeleteAccommodationState> {
  if (!isUuid(tripId) || !isUuid(accommodationId)) return { error: "Este hospedaje no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accommodations")
    .delete()
    .eq("id", accommodationId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("deleteAccommodation failed", error);
    return { error: "No pudimos borrar el hospedaje. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  redirect(listUrl(tripId));
}
