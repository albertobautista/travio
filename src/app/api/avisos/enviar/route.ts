import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { runNotifications } from "@/lib/notifications/run";

// Sending can take a while (one email after another).
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  // Constant time: the comparison doesn't leak how much of the secret matched.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * POST /api/avisos/enviar: one run of the notification job. Called every 10
 * minutes by pg_cron in Supabase (migration 20261005150000), with the shared
 * CRON_SECRET; anyone else gets 401.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runNotifications();
    return Response.json(result);
  } catch (error) {
    console.error("[notifications] run failed", error);
    return new Response("Failed", { status: 500 });
  }
}
