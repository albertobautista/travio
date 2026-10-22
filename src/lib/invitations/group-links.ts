import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { TripPreview } from "@/lib/trips/share";
import { isUuid } from "@/lib/uuid";

import { isInvitationToken } from "./queries";

// Group links: one link per trip for a WhatsApp group. Nobody joins with it
// directly; they ask, and the owner approves (see the migration
// 20261020120000_trip_group_links.sql). Same token format as invitations.

/** How long a group link can last, in days (create_trip_group_link checks the same). */
export const GROUP_LINK_DAYS = [1, 7, 30] as const;

/** What /unirse/<token> shows. Mirrors get_trip_group_link's jsonb. */
export type GroupLinkPreview = TripPreview & {
  /** member: already in; pending/rejected: the caller's request; full: the cap was reached. */
  status: "valid" | "expired" | "full" | "member" | "pending" | "rejected";
  expires_at: string;
  inviter_name: string | null;
};

/** The group link behind a token, or null if it doesn't exist, was replaced or revoked. Works signed out. */
export const getGroupLinkPreview = cache(async (token: string): Promise<GroupLinkPreview | null> => {
  if (!isInvitationToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_trip_group_link", { p_token: token });
  if (error) {
    console.error("get_trip_group_link failed", error);
    return null;
  }
  return (data as GroupLinkPreview | null) ?? null;
});

export type GroupLink = {
  id: string;
  expires_at: string;
  max_members: number | null;
  /** People it has let in so far (approved requests). */
  approved: number;
  expired: boolean;
};

/** The trip's group link, if any. Owner only (RLS); others get null. */
export const getGroupLink = cache(async (tripId: string): Promise<GroupLink | null> => {
  if (!isUuid(tripId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_group_links")
    .select("id, expires_at, max_members")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!data) return null;
  const { data: approved } = await supabase.rpc("group_link_approved_count", { p_link_id: data.id });
  return { ...data, approved: approved ?? 0, expired: new Date(data.expires_at).getTime() <= Date.now() };
});

export type JoinRequest = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

/** Requests waiting for the owner, oldest first. Owner only (RLS); others get []. */
export const getPendingJoinRequests = cache(async (tripId: string): Promise<JoinRequest[]> => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_join_requests")
    .select("id, name, email, avatar_url, created_at")
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
});
