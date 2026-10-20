"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { isInvitationToken } from "@/lib/invitations/queries";
import { notifyJoinRequest } from "@/lib/notifications/members";
import { createClient } from "@/lib/supabase/server";

/** `tripUrl`: already a member; the form opens it with a full page load. */
export type JoinRequestState = { error?: string; tripUrl?: string } | undefined;

/**
 * "Pedir unirme". request_to_join_trip checks the link (valid, not expired,
 * not full) and stores the request in one transaction. Nobody gets access
 * here: the owner approves later from Viajeros.
 */
export async function requestToJoin(token: string): Promise<JoinRequestState> {
  if (!isInvitationToken(token)) return { error: "Este enlace no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_to_join_trip", { p_token: token });

  if (error) {
    if (error.code === "42501") return { error: "Inicia sesión para pedir unirte al viaje." };
    console.error("requestToJoin failed", error);
    return { error: "No pudimos enviar tu solicitud. Inténtalo de nuevo." };
  }

  const result = data as { status: string; trip_id?: string; request_id?: string };
  switch (result.status) {
    case "requested": {
      const { trip_id, request_id } = result;
      // After the response: asking never waits for email.
      if (trip_id && request_id) after(() => notifyJoinRequest({ tripId: trip_id, requestId: request_id }));
      refresh(); // the page now says "pending"
      return;
    }
    case "pending":
      refresh();
      return;
    case "member":
      // Not redirect(): that navigates in place and keeps this page's
      // "no-referrer" policy (see the page's metadata).
      return { tripUrl: `/viajes/${result.trip_id}` };
    case "rejected":
      refresh();
      return;
    case "expired":
      return { error: "Este enlace caducó. Pide uno nuevo a quien lo compartió." };
    case "full":
      return { error: "Este enlace ya llegó a su máximo de personas. Pide uno nuevo a quien lo compartió." };
    case "too_many":
      return { error: "Este viaje tiene demasiadas solicitudes pendientes. Inténtalo más tarde." };
    default:
      return { error: "Este enlace ya no es válido. Pide uno nuevo a quien lo compartió." };
  }
}

/** "¿No eres tú?": sign out and sign in again with another account, keeping the link. */
export async function switchAccount(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(isInvitationToken(token) ? `/login?next=${encodeURIComponent(`/unirse/${token}`)}` : "/login");
}
