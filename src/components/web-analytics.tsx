"use client";

import { Analytics } from "@vercel/analytics/next";

import { redactAnalyticsUrl } from "@/lib/analytics/redact";

/**
 * Vercel Web Analytics: anonymous page views, no cookies. A client component
 * only because `beforeSend` is a function (src/lib/analytics/redact.ts).
 * Outside Vercel (npm run dev) it logs to the console instead of sending.
 */
export function WebAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />;
}
