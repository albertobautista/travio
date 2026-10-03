"use server";

import { redirect } from "next/navigation";

import { isInvitationToken } from "@/lib/invitations/queries";
import { createClient } from "@/lib/supabase/server";

export type AcceptInvitationState = { error?: string } | undefined;

/**
 * "Unirme al viaje". All the checks (valid, not expired, not used) and who
 * the person becomes in the trip (decided by the owner when creating the
 * invitation) happen inside accept_trip_invitation, in one transaction.
 */
export async function acceptInvitation(token: string): Promise<AcceptInvitationState> {
  if (!isInvitationToken(token)) return { error: "Este enlace no es válido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_trip_invitation", { p_token: token });

  if (error) {
    if (error.code === "42501") return { error: "Inicia sesión para unirte al viaje." };
    console.error("acceptInvitation failed", error);
    return { error: "No pudimos unirte al viaje. Inténtalo de nuevo." };
  }

  const result = data as { status: string; trip_id?: string };
  switch (result.status) {
    case "joined":
    case "member":
      return redirect(`/viajes/${result.trip_id}`);
    case "used":
      return { error: "Alguien más ya usó esta invitación. Pide un enlace nuevo." };
    case "expired":
      return { error: "Esta invitación caducó. Pide un enlace nuevo." };
    default:
      return { error: "Esta invitación ya no es válida. Pide un enlace nuevo." };
  }
}

/** "¿No eres tú?": sign out and sign in again with another account, keeping the invitation. */
export async function switchAccount(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(isInvitationToken(token) ? `/login?next=${encodeURIComponent(`/invitacion/${token}`)}` : "/login");
}
