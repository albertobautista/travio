"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

// Who can see and change the trip. Every rule lives in the database (RLS on
// trip_members and trip_invitations, plus the invitation functions); these
// actions only validate input and translate errors. Ids arrive via .bind()
// and can be tampered with, so blocked writes are detected by asking for the
// affected rows.

const denied = { error: "Solo el propietario del viaje puede gestionar el acceso." };

const isRole = (role: string): role is "editor" | "viewer" => role === "editor" || role === "viewer";

export type CreateInvitationState = { error?: string; token?: string; expiresAt?: string } | undefined;

/**
 * Creates a single-use invitation and returns its token. This is the only
 * time the token exists in clear: the database keeps just its hash, so the
 * link can't be shown again later, only replaced by a new one.
 */
export async function createInvitation(
  tripId: string,
  _prev: CreateInvitationState,
  formData: FormData,
): Promise<CreateInvitationState> {
  const role = String(formData.get("role") ?? "viewer");
  // "for": an existing traveler's id, "new" (someone new who's travelling) or
  // "follow" (just follows the trip, no traveler).
  const target = String(formData.get("for") ?? "");
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  if (!isRole(role)) return { error: "Elige un tipo de acceso." };
  if (target !== "new" && target !== "follow" && !isUuid(target)) return { error: "Elige para quién es la invitación." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trip_invitation", {
    p_trip_id: tripId,
    p_role: role,
    p_traveler_id: isUuid(target) ? target : undefined,
    p_adds_traveler: target === "new",
  });

  if (error) {
    switch (error.code) {
      case "42501":
        return denied;
      case "23505":
        return { error: "Esa persona ya tiene cuenta vinculada en este viaje." };
      case "23503":
        return { error: "Esa persona ya no está en el viaje." };
      default:
        console.error("createInvitation failed", error);
        return { error: "No pudimos crear la invitación. Inténtalo de nuevo." };
    }
  }

  const result = data as { token: string; expires_at: string };
  refresh(); // the pending list shows the new invitation
  return { token: result.token, expiresAt: result.expires_at };
}

export type AccessActionState = { error?: string } | undefined;

/** Revoke: a deleted invitation's link just stops working. */
export async function deleteInvitation(tripId: string, invitationId: string): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(invitationId)) return { error: "Esta invitación no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("trip_id", tripId)
    .select("id");
  if (error) {
    console.error("deleteInvitation failed", error);
    return { error: "No pudimos cancelar la invitación. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;
  refresh();
}

export async function changeMemberRole(tripId: string, userId: string, role: string): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(userId)) return { error: "Esta persona no existe." };
  if (!isRole(role)) return { error: "Elige un tipo de acceso." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_members")
    .update({ role })
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("changeMemberRole failed", error);
    return { error: "No pudimos cambiar el acceso. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;
  refresh();
}

/** The owner removes someone. Their traveler stays, unlinked (database trigger). */
export async function removeMember(tripId: string, userId: string): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(userId)) return { error: "Esta persona no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("removeMember failed", error);
    return { error: "No pudimos quitar el acceso. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;
  refresh();
}

/** Any member except the owner can leave (the owner transfers ownership first). */
export async function leaveTrip(tripId: string): Promise<AccessActionState> {
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { error: "Inicia sesión de nuevo." };

  const { data, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("leaveTrip failed", error);
    return { error: "No pudimos sacarte del viaje. Inténtalo de nuevo." };
  }
  if (data.length === 0) return { error: "El propietario no puede salir del viaje. Primero pasa la propiedad a otra persona." };
  redirect("/viajes");
}

/** The owner hands the trip to another member and becomes an editor. */
export async function transferOwnership(tripId: string, userId: string): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(userId)) return { error: "Esta persona no existe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_trip_ownership", { p_trip_id: tripId, p_new_owner_id: userId });
  if (error) {
    if (error.code === "42501") return denied;
    console.error("transferOwnership failed", error);
    return { error: "No pudimos pasar la propiedad. Inténtalo de nuevo." };
  }
  refresh();
}
