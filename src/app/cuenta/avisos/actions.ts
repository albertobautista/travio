"use server";

import { refresh } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type PreferencesState = { error?: string; saved?: boolean } | undefined;

const CHANGES = ["hourly", "daily", "off"] as const;

/** Saves the signed-in user's own preferences (RLS: own row only). */
export async function savePreferences(_prev: PreferencesState, formData: FormData): Promise<PreferencesState> {
  const changes = String(formData.get("changes") ?? "daily");
  if (!(CHANGES as readonly string[]).includes(changes)) return { error: "Elige cada cuánto avisarte de cambios." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { error: "Inicia sesión de nuevo." };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: userId,
      members: formData.get("members") === "on",
      changes,
      reminders: formData.get("reminders") === "on",
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("savePreferences failed", error);
    return { error: "No pudimos guardar. Inténtalo de nuevo." };
  }
  refresh();
  return { saved: true };
}
