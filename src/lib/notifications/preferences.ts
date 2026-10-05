import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { isChangesFrequency, type ChangesFrequency } from "./options";

export type { ChangesFrequency };

export type Preferences = { members: boolean; changes: ChangesFrequency; reminders: boolean; unsubscribe_token: string };

/**
 * Each user's preferences, creating the default row for those without one
 * (so everyone has an unsubscribe token for their emails). Admin client:
 * runs for other users (the recipients), with no session.
 */
export async function preferencesOf(userIds: string[]): Promise<Map<string, Preferences>> {
  const ids = [...new Set(userIds)];
  const result = new Map<string, Preferences>();
  if (ids.length === 0) return result;
  const admin = createAdminClient();
  await admin.from("notification_preferences").upsert(
    ids.map((user_id) => ({ user_id })),
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  const { data, error } = await admin
    .from("notification_preferences")
    .select("user_id, members, changes, reminders, unsubscribe_token")
    .in("user_id", ids);
  if (error) console.error("preferencesOf failed", error);
  for (const { user_id, changes, ...p } of data ?? []) {
    result.set(user_id, { ...p, changes: isChangesFrequency(changes) ? changes : "daily" });
  }
  return result;
}

export const preferencesUrl = (base: string) => `${base}/cuenta/avisos`;
/** One-click unsubscribe (mail apps POST here) and the link in the footer. */
export const unsubscribeUrl = (base: string, token: string) => `${base}/avisos/baja?t=${token}`;
export const oneClickUnsubscribeUrl = (base: string, token: string) => `${base}/avisos/baja/confirmar?t=${token}`;
