"use server";

import { redirect } from "next/navigation";

import { routeKey } from "@/lib/options/compare";
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
  // An option goes back to the list, next to the ones it's compared with.
  if (parsed.data.booking_status === "option") redirect(`${listUrl(tripId)}?opcion=guardada`);
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

export type OptionActionState = { error?: string } | undefined;

/**
 * Choosing an option: it becomes a leg of the trip, either already paid
 * ("booked") or decided but still to book ("planned"). Only changes rows that
 * are still options, so a double tap can't downgrade a confirmed leg.
 */
export async function chooseTransportationOption(
  tripId: string,
  transportationId: string,
  status: "planned" | "booked",
): Promise<OptionActionState> {
  if (!isUuid(tripId) || !isUuid(transportationId)) return { error: "Esta opción no existe." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transportations")
    .update({ booking_status: status })
    .eq("id", transportationId)
    .eq("trip_id", tripId)
    .eq("booking_status", "option")
    .select("id");

  if (error) {
    console.error("chooseTransportationOption failed", error);
    return { error: "No pudimos elegir esta opción. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje, o ya la eligieron." };

  redirect(`/viajes/${tripId}/transporte/${transportationId}?elegida=1`);
}

/** After choosing a leg: deletes the other options for the same route (their files stay in Documentos). */
export async function deleteOtherTransportationOptions(tripId: string, transportationId: string): Promise<OptionActionState> {
  if (!isUuid(tripId) || !isUuid(transportationId)) return { error: "Este transporte no existe." };

  const supabase = await createClient();
  const [{ data: chosen }, { data: options }] = await Promise.all([
    supabase
      .from("transportations")
      .select("origin_name, destination_name")
      .eq("id", transportationId)
      .eq("trip_id", tripId)
      .maybeSingle(),
    supabase
      .from("transportations")
      .select("id, origin_name, destination_name")
      .eq("trip_id", tripId)
      .eq("booking_status", "option"),
  ]);
  if (!chosen) return { error: "Este transporte no existe." };

  // Same route as the list groups them: written slightly differently still counts.
  const ids = (options ?? []).filter((o) => o.id !== transportationId && routeKey(o) === routeKey(chosen)).map((o) => o.id);
  if (ids.length > 0) {
    const { error } = await supabase.from("transportations").delete().eq("trip_id", tripId).in("id", ids).eq("booking_status", "option");
    if (error) {
      console.error("deleteOtherTransportationOptions failed", error);
      return { error: "No pudimos borrar las otras opciones. Inténtalo de nuevo." };
    }
  }
  redirect(listUrl(tripId));
}
