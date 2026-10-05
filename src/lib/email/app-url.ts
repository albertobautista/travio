import "server-only";

import { headers } from "next/headers";

/**
 * Absolute URL of the app, for links in emails. In a request, the origin the
 * user is on; outside one (scheduled emails), APP_URL, else Vercel's
 * production domain.
 */
export async function appUrl() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  } catch {
    // No request (cron): fall through.
  }
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
