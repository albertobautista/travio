import "server-only";

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
