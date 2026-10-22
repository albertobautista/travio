"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import InvitationEmail from "@/emails/invitation";
import { appUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send";
import { GROUP_LINK_DAYS } from "@/lib/invitations/group-links";
import { notifyJoinApproved, notifyMemberChange } from "@/lib/notifications/members";
import { createClient } from "@/lib/supabase/server";
import { formatTripDates } from "@/lib/trips/dates";
import { isMemberPermission, MEMBER_PERMISSIONS } from "@/lib/trips/permissions";
import { isUuid } from "@/lib/uuid";

// Who can see and change the trip. Every rule lives in the database (RLS on
// trip_members and trip_invitations, plus the invitation functions); these
// actions only validate input and translate errors. Ids arrive via .bind()
// and can be tampered with, so blocked writes are detected by asking for the
// affected rows.

const denied = { error: "Solo el propietario del viaje puede gestionar el acceso." };

const isRole = (role: string): role is "editor" | "viewer" => role === "editor" || role === "viewer";

export type CreateInvitationState =
  | {
      error?: string;
      token?: string;
      expiresAt?: string;
      /** Set when an email was asked for: whether it went out. */
      emailedTo?: string;
      emailFailed?: boolean;
    }
  | undefined;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const expiryFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" });

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
  // Optional: send the link to this address too.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: "Revisa el correo: no parece válido." };
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  if (!isRole(role)) return { error: "Elige un tipo de acceso." };
  if (target !== "new" && target !== "follow" && !isUuid(target)) return { error: "Elige para quién es la invitación." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trip_invitation", {
    p_trip_id: tripId,
    p_role: role,
    p_traveler_id: isUuid(target) ? target : undefined,
    p_adds_traveler: target === "new",
    p_email: email || undefined,
  });

  if (error) {
    switch (error.code) {
      case "42501":
        return denied;
      case "23505":
        return { error: "Esa persona ya tiene cuenta vinculada en este viaje." };
      case "23503":
        return { error: "Esa persona ya no está en el viaje." };
      case "53400":
        return { error: "Ya enviaste muchas invitaciones por correo hoy. Copia el enlace o inténtalo mañana." };
      default:
        console.error("createInvitation failed", error);
        return { error: "No pudimos crear la invitación. Inténtalo de nuevo." };
    }
  }

  const result = data as { token: string; expires_at: string };
  refresh(); // the pending list shows the new invitation
  if (!email) return { token: result.token, expiresAt: result.expires_at };

  // Sent now (not after the response) so the form can say whether it went out.
  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: trip }, { data: me }, { data: traveler }] = await Promise.all([
    supabase.from("trips").select("name, start_date, end_date").eq("id", tripId).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", claims?.claims.sub ?? "").maybeSingle(),
    isUuid(target)
      ? supabase.from("travelers").select("name").eq("id", target).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const inviterName = me?.display_name?.trim() || "Alguien";
  const tripName = trip?.name ?? "un viaje";
  const { sent } = await sendEmail({
    to: email,
    subject: `${inviterName} te invitó a ${tripName}`,
    email: InvitationEmail({
      inviterName,
      tripName,
      dates: trip?.start_date ? formatTripDates(trip.start_date, trip.end_date) : null,
      role,
      travelerName: traveler?.name ?? null,
      url: `${await appUrl()}/invitacion/${result.token}`,
      expires: expiryFormat.format(new Date(result.expires_at)),
    }),
  });
  return { token: result.token, expiresAt: result.expires_at, emailedTo: email, emailFailed: !sent };
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

export type CreateGroupLinkState = { error?: string; token?: string; expiresAt?: string } | undefined;

/**
 * Creates the trip's group link, replacing the previous one (its link stops
 * working; requests already made stay). Like an invitation, the token is
 * returned only now.
 */
export async function createGroupLink(
  tripId: string,
  _prev: CreateGroupLinkState,
  formData: FormData,
): Promise<CreateGroupLinkState> {
  const days = Number(formData.get("days") ?? 7);
  const maxRaw = String(formData.get("max") ?? "").trim();
  const max = maxRaw ? Number(maxRaw) : null;
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  if (!(GROUP_LINK_DAYS as readonly number[]).includes(days)) return { error: "Elige cuánto dura el enlace." };
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 100)) {
    return { error: "El máximo de personas va de 1 a 100, o déjalo vacío." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trip_group_link", {
    p_trip_id: tripId,
    p_days: days,
    p_max_members: max ?? undefined,
  });
  if (error) {
    if (error.code === "42501") return denied;
    console.error("createGroupLink failed", error);
    return { error: "No pudimos crear el enlace. Inténtalo de nuevo." };
  }
  const result = data as { token: string; expires_at: string };
  refresh();
  return { token: result.token, expiresAt: result.expires_at };
}

/** Revoke the group link: it stops working. Requests already made stay. */
export async function deleteGroupLink(tripId: string, linkId: string): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(linkId)) return { error: "Este enlace no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_group_links")
    .delete()
    .eq("id", linkId)
    .eq("trip_id", tripId)
    .select("id");
  if (error) {
    console.error("deleteGroupLink failed", error);
    return { error: "No pudimos desactivar el enlace. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;
  refresh();
}

/**
 * The owner approves or rejects a request made with the group link. On
 * approval the owner also picks the access and whether the person travels:
 * "follow" (no traveler), "new" (a new traveler with their name) or the id
 * of a traveler without an account. decide_join_request checks it all.
 */
export async function decideJoinRequest(
  tripId: string,
  requestId: string,
  decision: { approve: boolean; role?: string; for?: string },
): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(requestId)) return { error: "Esta solicitud no existe." };
  const role = decision.role ?? "viewer";
  const target = decision.for ?? "follow";
  if (decision.approve) {
    if (!isRole(role)) return { error: "Elige un tipo de acceso." };
    if (target !== "new" && target !== "follow" && !isUuid(target)) return { error: "Elige si viaja y como quién." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_join_request", {
    p_request_id: requestId,
    p_approve: decision.approve,
    p_role: role,
    p_traveler_id: decision.approve && isUuid(target) ? target : undefined,
    p_adds_traveler: decision.approve && target === "new",
  });
  if (error) {
    switch (error.code) {
      case "42501":
        return denied;
      case "23505":
        return { error: "Ese viajero ya tiene una cuenta vinculada. Elige otra opción." };
      default:
        console.error("decideJoinRequest failed", error);
        return { error: "No pudimos guardar tu respuesta. Inténtalo de nuevo." };
    }
  }

  const result = data as { status: string; trip_id?: string; user_id?: string; role?: "editor" | "viewer" };
  if (result.status === "full") {
    return { error: "El enlace ya llegó a su máximo de personas. Crea uno nuevo o quita a alguien primero." };
  }
  if (result.status === "approved" && result.trip_id && result.user_id) {
    const { trip_id, user_id } = result;
    after(() => notifyJoinApproved({ tripId: trip_id, userId: user_id, role: result.role ?? "viewer" }));
  }
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

/**
 * The owner decides what else a viewer may add (saved places, expenses...).
 * The whole list is replaced; the order is kept stable for tidy rows.
 */
export async function setMemberPermissions(tripId: string, userId: string, permissions: string[]): Promise<AccessActionState> {
  if (!isUuid(tripId) || !isUuid(userId)) return { error: "Esta persona no existe." };
  if (!Array.isArray(permissions) || !permissions.every(isMemberPermission)) return { error: "Elige permisos de la lista." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_members")
    .update({ permissions: MEMBER_PERMISSIONS.filter((p) => permissions.includes(p)) })
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("setMemberPermissions failed", error);
    return { error: "No pudimos cambiar los permisos. Inténtalo de nuevo." };
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
  after(() => notifyMemberChange({ tripId, memberId: userId, kind: "left" }));
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
