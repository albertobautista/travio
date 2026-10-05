import type { NextRequest } from "next/server";

import { unsubscribeByToken } from "@/lib/notifications/unsubscribe";

/**
 * One-click unsubscribe (RFC 8058): Gmail, Apple Mail… POST here from their
 * own "Unsubscribe" button, using the List-Unsubscribe header of our emails.
 */
export async function POST(request: NextRequest) {
  const ok = await unsubscribeByToken(request.nextUrl.searchParams.get("t"));
  return new Response(ok ? "OK" : "Not found", { status: ok ? 200 : 404 });
}
