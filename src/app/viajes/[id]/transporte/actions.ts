"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseTransportForm, type TransportFormState } from "@/lib/transportations/transport-form";
import { isUuid } from "@/lib/uuid";

// Ids arrive via .bind() and can be tampered with; RLS decides what the user
// may change. Blocked writes return zero rows, so every write asks for them.

async function loadContext(tripId: string) {
  const supabase = await createClient();
  const [{ data: trip }, { data: travelers }] = await Promise.all([
    supabase.from("trips").select("start_date, end_date, currency").eq("id", tripId).maybeSingle(),
    supabase.from("travelers").select("id").eq("trip_id", tripId),
  ]);
  return trip ? { trip, travelerIds: (travelers ?? []).map((t) => t.id) } : null;
}

/**
 * Who travels and their seats, saved after the row exists. If it fails the
 * trip leg is already saved, so we open it with a notice instead of returning
 * to the form (a resubmit would create a duplicate).
 */
async function saveTravelers(tripId: string, transportationId: string, travelers: { traveler_id: string; seat: string | null }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_transportation_participants", {
    p_transportation_id: transportationId,
    p_travelers: travelers,
  });
  if (error) {
    console.error("set_transportation_participants failed", error);
    redirect(`/viajes/${tripId}/transporte/${transportationId}?participantes=error`);
  }
}

const listUrl = (tripId: string) => `/viajes/${tripId}/transporte`;

export async function createTransportation(
  tripId: string,
  _prev: TransportFormState,
  formData: FormData,
): Promise<TransportFormState> {
  const context = isUuid(tripId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Este viaje no existe." };

  const parsed = parseTransportForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportations")
    .insert({ ...parsed.data, trip_id: tripId })
    .select("id");

  if (error) {
    console.error("createTransportation failed", error);
    const denied = error.code === "42501";
    return {
      error: denied ? "No tienes permiso para editar este viaje." : "No pudimos guardar el transporte. Inténtalo de nuevo.",
      values: parsed.values,
    };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  await saveTravelers(tripId, data[0].id, parsed.travelers);
  // Straight to the new leg, where the ticket or boarding pass can be attached.
  redirect(`/viajes/${tripId}/transporte/${data[0].id}?nuevo=1`);
}

export async function updateTransportation(
  tripId: string,
  transportationId: string,
  _prev: TransportFormState,
  formData: FormData,
): Promise<TransportFormState> {
  const context = isUuid(tripId) && isUuid(transportationId) ? await loadContext(tripId) : null;
  if (!context) return { error: "Este transporte no existe." };

  const parsed = parseTransportForm(formData, context);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: parsed.values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportations")
    .update(parsed.data)
    .eq("id", transportationId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("updateTransportation failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values: parsed.values };

  await saveTravelers(tripId, transportationId, parsed.travelers);
  redirect(listUrl(tripId));
}

export type DeleteTransportationState = { error?: string } | undefined;

/** Its tickets stay as trip documents (files.transportation_id is set to null). */
export async function deleteTransportation(tripId: string, transportationId: string): Promise<DeleteTransportationState> {
  if (!isUuid(tripId) || !isUuid(transportationId)) return { error: "Este transporte no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportations")
    .delete()
    .eq("id", transportationId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("deleteTransportation failed", error);
    return { error: "No pudimos borrar el transporte. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  redirect(listUrl(tripId));
}
