import { NextResponse, type NextRequest } from "next/server";

import { callbackUrl } from "@/lib/auth/callback-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/google, from the "Continuar con Google" form on /login.
 *
 * Why a Route Handler and not a Server Action: a Server Action that redirects
 * to another site makes the Next.js router try to fetch that URL for an RSC
 * payload first. Google refuses the cross-origin fetch (a CORS error in the
 * console) before Next falls back to a normal navigation. A plain form POST to
 * this route is an ordinary browser navigation, so the 303 below goes straight
 * to Supabase and then Google. It also works without JavaScript.
 *
 * signInWithOAuth uses PKCE: it stores a code verifier in a cookie (set here,
 * on this response) that /auth/callback needs to exchange Google's code for a
 * session.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const next = safeRedirectPath(formData.get("next") as string | null);
  const origin = request.nextUrl.origin;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(origin, next) },
  });

  if (error || !data.url) {
    if (error) console.error("signInWithOAuth failed", error);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, 303);
  }

  // 303: the browser follows it with a GET, as a form POST redirect should.
  return NextResponse.redirect(data.url, 303);
}
