/**
 * Only allow redirects to paths inside this app. A `next` query param like
 * "https://evil.com" or "//evil.com" would otherwise turn the login page into
 * an open redirect.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/viajes") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
