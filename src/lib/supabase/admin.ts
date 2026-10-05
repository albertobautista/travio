import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Supabase with the SECRET key: bypasses RLS. Only for work that has no
 * signed-in user behind it, or that must read what the user can't:
 * - recipients' email addresses (auth.users), to send them notifications;
 * - scheduled emails (digests, reminders), which run with nobody signed in.
 *
 * Everything a user does still goes through createClient() in ./server, with
 * their session, so RLS decides. Never import this from a Client Component
 * ("server-only" makes the build fail if someone tries).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The email of each user id that has one (missing or deleted users are left out). */
export async function emailsOf(userIds: string[]) {
  const admin = createAdminClient();
  const emails = new Map<string, string>();
  await Promise.all(
    [...new Set(userIds)].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data.user?.email) emails.set(id, data.user.email);
    }),
  );
  return emails;
}
