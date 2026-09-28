"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseTripForm, type TripFormState } from "@/lib/trips/trip-form";
import { isUuid } from "@/lib/uuid";

// tripId arrives via .bind() from the page. Bound arguments travel through the
// browser and can be tampered with, which is fine: RLS decides what the user
// may change, not this value.

export async function updateTrip(tripId: string, _prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const parsed = parseTripForm(formData);
  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors, values: parsed.values };
  }
  if (!isUuid(tripId)) {
    return { error: "Este viaje no existe.", values: parsed.values };
  }

  const supabase = await createClient();
  // .select() makes Postgres return the updated rows. When RLS blocks an update
  // there is no error, just zero rows, so this is how we detect it.
  const { data, error } = await supabase.from("trips").update(parsed.data).eq("id", tripId).select("id");

  if (error) {
    console.error("updateTrip failed", error);
    return { error: "No pudimos guardar los cambios. Inténtalo de nuevo.", values: parsed.values };
  }
  if (data.length === 0) {
    return { error: "No tienes permiso para editar este viaje.", values: parsed.values };
  }

  redirect(`/viajes/${tripId}`);
}

export type DeleteTripState = { error?: string } | undefined;

// useActionState also passes the previous state; deleting doesn't need it.
export async function deleteTrip(tripId: string): Promise<DeleteTripState> {
  if (!isUuid(tripId)) {
    return { error: "Este viaje no existe." };
  }

  const supabase = await createClient();
  // Only the owner passes the delete policy. Members, and later stops,
  // activities, etc., go with it through `on delete cascade`.
  const { data, error } = await supabase.from("trips").delete().eq("id", tripId).select("id");

  if (error) {
    console.error("deleteTrip failed", error);
    return { error: "No pudimos borrar el viaje. Inténtalo de nuevo." };
  }
  if (data.length === 0) {
    return { error: "Solo el propietario puede borrar este viaje." };
  }

  redirect("/viajes");
}
