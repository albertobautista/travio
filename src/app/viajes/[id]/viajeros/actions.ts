"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { nextTravelerColor } from "@/lib/travelers/colors";
import { isUuid } from "@/lib/uuid";

export type TravelerFormValues = { name: string; user_id: string };
export type TravelerFormState =
  | {
      error?: string;
      fieldErrors?: Partial<Record<keyof TravelerFormValues, string>>;
      values?: TravelerFormValues;
    }
  | undefined;

function parse(formData: FormData) {
  const values: TravelerFormValues = {
    name: String(formData.get("name") ?? "").trim(),
    user_id: String(formData.get("user_id") ?? ""),
  };
  const fieldErrors: NonNullable<TravelerFormState>["fieldErrors"] = {};
  if (!values.name) fieldErrors.name = "Escribe el nombre.";
  else if (values.name.length > 80) fieldErrors.name = "Máximo 80 caracteres.";
  if (values.user_id && !isUuid(values.user_id)) fieldErrors.user_id = "Elige una persona de la lista.";
  return { values, fieldErrors };
}

/** Database errors -> a message on the right field. */
function describeError(error: { code?: string }, values: TravelerFormValues): TravelerFormState {
  switch (error.code) {
    case "23505": // travelers_one_per_user
      return { fieldErrors: { user_id: "Esa cuenta ya está vinculada a otro viajero." }, values };
    case "23514": // check_traveler_user_is_member
      return { fieldErrors: { user_id: "Esa persona no tiene acceso a este viaje." }, values };
    case "42501":
      return { error: "No tienes permiso para editar este viaje.", values };
    default:
      return { error: "No pudimos guardar. Inténtalo de nuevo.", values };
  }
}

export async function createTraveler(tripId: string, _prev: TravelerFormState, formData: FormData): Promise<TravelerFormState> {
  const { values, fieldErrors } = parse(formData);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };
  if (!isUuid(tripId)) return { error: "Este viaje no existe.", values };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("travelers").select("color").eq("trip_id", tripId);

  const { data, error } = await supabase
    .from("travelers")
    .insert({
      trip_id: tripId,
      name: values.name,
      user_id: values.user_id || null,
      color: nextTravelerColor((existing ?? []).map((t) => t.color)),
    })
    .select("id");

  if (error) {
    console.error("createTraveler failed", error);
    return describeError(error, values);
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values };

  redirect(`/viajes/${tripId}/viajeros`);
}

export async function updateTraveler(
  tripId: string,
  travelerId: string,
  _prev: TravelerFormState,
  formData: FormData,
): Promise<TravelerFormState> {
  const { values, fieldErrors } = parse(formData);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };
  if (!isUuid(tripId) || !isUuid(travelerId)) return { error: "Este viajero no existe.", values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("travelers")
    .update({ name: values.name, user_id: values.user_id || null })
    .eq("id", travelerId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("updateTraveler failed", error);
    return describeError(error, values);
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje.", values };

  redirect(`/viajes/${tripId}/viajeros`);
}

export type DeleteTravelerState = { error?: string } | undefined;

export async function deleteTraveler(tripId: string, travelerId: string): Promise<DeleteTravelerState> {
  if (!isUuid(tripId) || !isUuid(travelerId)) return { error: "Este viajero no existe." };
  const supabase = await createClient();

  // No participant rows means "everyone". If this traveler is the only
  // participant of an activity, deleting them would silently turn that
  // activity into "everyone", so we ask the user to decide first.
  const { data: theirs } = await supabase
    .from("activity_participants")
    .select("activity_id, activities (title)")
    .eq("trip_id", tripId)
    .eq("traveler_id", travelerId);
  const activityIds = (theirs ?? []).map((p) => p.activity_id);
  if (activityIds.length > 0) {
    const { data: all } = await supabase.from("activity_participants").select("activity_id").in("activity_id", activityIds);
    const counts = new Map<string, number>();
    for (const p of all ?? []) counts.set(p.activity_id, (counts.get(p.activity_id) ?? 0) + 1);
    const soleIn = (theirs ?? []).filter((p) => counts.get(p.activity_id) === 1).map((p) => p.activities?.title ?? "");
    if (soleIn.length > 0) {
      return {
        error: `Es la única persona en: ${soleIn.join(", ")}. Cambia quién va a ${soleIn.length === 1 ? "esa actividad" : "esas actividades"} antes de quitarla.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("travelers")
    .delete()
    .eq("id", travelerId)
    .eq("trip_id", tripId)
    .select("id");

  if (error) {
    console.error("deleteTraveler failed", error);
    return { error: "No pudimos quitar a esta persona. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "No tienes permiso para editar este viaje." };

  redirect(`/viajes/${tripId}/viajeros`);
}
