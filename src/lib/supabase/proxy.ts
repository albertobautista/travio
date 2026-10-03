import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

/** Routes that work without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ["/", "/login"];
// /invitacion/: the invitation page shows a preview before signing in.
const PUBLIC_PREFIXES = ["/auth/", "/invitacion/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Runs before every page request (see src/proxy.ts):
 * 1. Refreshes the Supabase session if the access token expired, writing the
 *    new cookies to both the request (for this render) and the response (for
 *    the browser).
 * 2. Redirects signed-out users away from private pages, and signed-in users
 *    away from /login.
 *
 * This is an optimistic check for navigation only. Real authorization is RLS
 * in the database; pages must still handle a missing user.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // No-cache headers: a response carrying auth cookies must never be
          // cached and served to another user.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims: getClaims both
  // validates the token and triggers the refresh that calls setAll above.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && !isPublic(pathname)) {
    return redirectPreservingCookies(request, response, "/login", {
      next: pathname + search,
    });
  }

  if (isSignedIn && pathname === "/login") {
    return redirectPreservingCookies(request, response, "/viajes");
  }

  return response;
}

/** A redirect must carry any refreshed session cookies, or the user gets signed out. */
function redirectPreservingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();

  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  // Headers iterate with lowercase names.
  from.headers.forEach((value, key) => {
    if (["cache-control", "expires", "pragma"].includes(key)) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
