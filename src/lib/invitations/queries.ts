import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/** create_trip_invitation makes 32 random bytes, base64url without padding. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isInvitationToken(value: string) {
  return TOKEN.test(value);
}

export type InvitationRole = "editor" | "viewer";

export const ROLE_LABELS: Record<InvitationRole | "owner", string> = {
  owner: "Propietario",
  editor: "Puede editar",
  viewer: "Solo lectura",
};

/** What the invitation page shows. Mirrors get_trip_invitation's jsonb. */
export type InvitationPreview = {
  status: "valid" | "expired" | "used" | "member";
  trip_id: string;
  trip_name: string;
  start_date: string | null;
  end_date: string | null;
  role: InvitationRole;
  expires_at: string;
  inviter_name: string | null;
  /** Set when the invitation was made for a traveler who still has no account. */
  traveler_name: string | null;
  /** Accepting adds the person as a new traveler, with their account's name. */
  adds_traveler: boolean;
};

/**
 * The invitation behind a link, or null if it doesn't exist or was revoked.
 * Works signed out: the database function only reveals the preview fields.
 */
export const getInvitationPreview = cache(async (token: string): Promise<InvitationPreview | null> => {
  if (!isInvitationToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_trip_invitation", { p_token: token });
  if (error) {
    console.error("get_trip_invitation failed", error);
    return null;
  }
  return (data as InvitationPreview | null) ?? null;
});

export type PendingInvitation = {
  id: string;
  role: InvitationRole;
  expires_at: string;
  created_at: string;
  traveler_name: string | null;
  adds_traveler: boolean;
  /** Where the link was emailed, if it was. */
  email: string | null;
  expired: boolean;
};

/** Invitations nobody has accepted yet, newest first. Owner only (RLS); others get []. */
export const getPendingInvitations = cache(async (tripId: string): Promise<PendingInvitation[]> => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_invitations")
    .select("id, role, expires_at, created_at, adds_traveler, email, traveler:travelers (name)")
    .eq("trip_id", tripId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  const now = Date.now();
  return (data ?? []).map(({ traveler, role, ...inv }) => ({
    ...inv,
    role: role as InvitationRole,
    traveler_name: traveler?.name ?? null,
    expired: new Date(inv.expires_at).getTime() <= now,
  }));
});
