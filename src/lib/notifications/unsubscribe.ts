import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/uuid";

/**
 * Turn every notification off for the owner of this token. Admin client: the
 * link works without signing in (mail apps call it on their own), and the
 * random token is what proves it's that person's link.
 */
export async function unsubscribeByToken(token: string | null): Promise<boolean> {
  if (!token || !isUuid(token)) return false;
  const { data, error } = await createAdminClient()
    .from("notification_preferences")
    .update({ members: false, changes: "off", reminders: false })
    .eq("unsubscribe_token", token)
    .select("user_id");
  if (error) console.error("unsubscribeByToken failed", error);
  return (data?.length ?? 0) > 0;
}
