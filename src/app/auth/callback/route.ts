import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sign-in and email confirmation links land.
 * Supabase sends a one-time `code`; exchanging it creates the session cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    // Usually a missing PKCE code verifier cookie: the sign-in started on a
    // different host (127.0.0.1 vs localhost) or the code was already used.
    console.error("exchangeCodeForSession failed", error);
  } else {
    // Supabase or the provider refused before issuing a code, and says why here.
    console.error("auth callback without code", searchParams.get("error"), searchParams.get("error_description"));
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "callback");
  return NextResponse.redirect(loginUrl);
}
