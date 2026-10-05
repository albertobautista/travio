import "server-only";

import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Travio <onboarding@resend.dev>";

/**
 * Send one email. Templates are React components (src/emails/), rendered to
 * HTML plus a plain-text version (better for spam filters and some readers).
 *
 * Never throws: a failed email must not undo what the user just did. It
 * returns whether it was sent so the caller can tell the user.
 * Without RESEND_API_KEY (local development) it only logs what it would send.
 */
export async function sendEmail({
  to,
  subject,
  email,
  unsubscribeUrl,
}: {
  to: string;
  subject: string;
  email: ReactElement;
  /** One-click unsubscribe (List-Unsubscribe header) for notification emails. */
  unsubscribeUrl?: string;
}): Promise<{ sent: boolean }> {
  try {
    const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.info(`[email] (not sent: no RESEND_API_KEY) to=${to} subject=${subject}\n${text}`);
      return { sent: false };
    }
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
      headers: unsubscribeUrl
        ? { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    });
    if (error) {
      console.error("[email] Resend refused", subject, error);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("[email] sending failed", subject, error);
    return { sent: false };
  }
}
