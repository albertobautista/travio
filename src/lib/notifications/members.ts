import "server-only";

import JoinRequestEmail from "@/emails/join-request";
import MemberChangeEmail from "@/emails/member-change";
import { appUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient, emailsOf } from "@/lib/supabase/admin";

import { oneClickUnsubscribeUrl, preferencesOf, preferencesUrl, unsubscribeUrl } from "./preferences";

/**
 * "Ximena se unió a España 2026" / "… salió de …", right away, to the trip's
 * owner and to whoever sent the invitation (never to the person themselves),
 * if they keep "members" notifications on.
 *
 * Meant to run after the response (next/server `after`), so the person
 * joining or leaving never waits for email.
 */
export async function notifyMemberChange({
  tripId,
  memberId,
  kind,
  role,
  inviterId,
}: {
  tripId: string;
  memberId: string;
  kind: "joined" | "left";
  role?: "editor" | "viewer";
  inviterId?: string | null;
}) {
  const admin = createAdminClient();
  const [{ data: trip }, { data: owner }, { data: member }] = await Promise.all([
    admin.from("trips").select("name").eq("id", tripId).maybeSingle(),
    admin.from("trip_members").select("user_id").eq("trip_id", tripId).eq("role", "owner").maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", memberId).maybeSingle(),
  ]);
  if (!trip) return;

  const recipients = [owner?.user_id, inviterId].filter((id): id is string => Boolean(id) && id !== memberId);
  if (recipients.length === 0) return;
  const [prefs, emails, base] = await Promise.all([preferencesOf(recipients), emailsOf(recipients), appUrl()]);
  const name = member?.display_name?.trim() || "Alguien";

  await Promise.all(
    [...new Set(recipients)].map((id) => {
      const p = prefs.get(id);
      const to = emails.get(id);
      if (!p?.members || !to) return;
      return sendEmail({
        to,
        subject: kind === "joined" ? `${name} se unió a ${trip.name}` : `${name} salió de ${trip.name}`,
        unsubscribeUrl: oneClickUnsubscribeUrl(base, p.unsubscribe_token),
        email: MemberChangeEmail({
          kind,
          memberName: name,
          tripName: trip.name,
          role,
          url: `${base}/viajes/${tripId}/viajeros`,
          preferencesUrl: preferencesUrl(base),
          unsubscribeUrl: unsubscribeUrl(base, p.unsubscribe_token),
        }),
      });
    }),
  );
}

/**
 * "Ana quiere unirse a España 2026": someone asked through the group link.
 * To the trip's owner, if they keep "members" notifications on. After the
 * response, like notifyMemberChange.
 */
export async function notifyJoinRequest({ tripId, requestId }: { tripId: string; requestId: string }) {
  const admin = createAdminClient();
  const [{ data: trip }, { data: owner }, { data: request }] = await Promise.all([
    admin.from("trips").select("name").eq("id", tripId).maybeSingle(),
    admin.from("trip_members").select("user_id").eq("trip_id", tripId).eq("role", "owner").maybeSingle(),
    admin.from("trip_join_requests").select("name, email, status").eq("id", requestId).maybeSingle(),
  ]);
  if (!trip || !owner || request?.status !== "pending") return;

  const [prefs, emails, base] = await Promise.all([preferencesOf([owner.user_id]), emailsOf([owner.user_id]), appUrl()]);
  const p = prefs.get(owner.user_id);
  const to = emails.get(owner.user_id);
  if (!p?.members || !to) return;
  await sendEmail({
    to,
    subject: `${request.name} quiere unirse a ${trip.name}`,
    unsubscribeUrl: oneClickUnsubscribeUrl(base, p.unsubscribe_token),
    email: JoinRequestEmail({
      kind: "requested",
      requesterName: request.name,
      requesterEmail: request.email,
      tripName: trip.name,
      url: `${base}/viajes/${tripId}/viajeros#solicitudes`,
      preferencesUrl: preferencesUrl(base),
      unsubscribeUrl: unsubscribeUrl(base, p.unsubscribe_token),
    }),
  });
}

/**
 * "Ya puedes ver España 2026": to the person the owner just let in. Always
 * sent: it answers their own request, like a sign-in email.
 */
export async function notifyJoinApproved({ tripId, userId, role }: { tripId: string; userId: string; role: "editor" | "viewer" }) {
  const admin = createAdminClient();
  const [{ data: trip }, emails, base] = await Promise.all([
    admin.from("trips").select("name").eq("id", tripId).maybeSingle(),
    emailsOf([userId]),
    appUrl(),
  ]);
  const to = emails.get(userId);
  if (!trip || !to) return;
  await sendEmail({
    to,
    subject: `Ya puedes ver ${trip.name} en Travio`,
    email: JoinRequestEmail({ kind: "approved", requesterName: "", tripName: trip.name, role, url: `${base}/viajes/${tripId}` }),
  });
}
