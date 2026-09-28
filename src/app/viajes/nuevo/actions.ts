"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { parseTripForm, type TripFormState } from "@/lib/trips/trip-form";

export async function createTrip(_prev: TripFormState, formData: FormData): Promise<TripFormState> {
  const parsed = parseTripForm(formData);
  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors, values: parsed.values };
  }

  const supabase = await createClient();
  // created_by defaults to auth.uid() in the database, and a trigger makes the
  // creator the owner (see the trips_and_membership migration).
  const { data, error } = await supabase.from("trips").insert(parsed.data).select("id").single();

  if (error) {
    console.error("createTrip failed", error);
    return { error: "No pudimos crear el viaje. Inténtalo de nuevo.", values: parsed.values };
  }

  // With a cover picked, the browser uploads it next (it needs the trip to exist
  // first, because Storage only accepts files in folders of trips the user can
  // edit). It navigates on its own afterwards. Without JavaScript this field is
  // empty and we redirect as usual.
  if (formData.get("cover") === "pending") {
    return { createdTripId: data.id, values: parsed.values };
  }

  redirect(`/viajes/${data.id}`);
}
