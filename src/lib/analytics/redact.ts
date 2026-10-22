/**
 * What Vercel Web Analytics may see of a URL. Invitation and share links carry
 * their secret in the path (whoever has it can join or preview the trip), and
 * query strings can carry sign-in codes or `next` paths, so both are cut
 * before the page view leaves the browser.
 */
const SECRET_PATH = /^\/(invitacion|unirse|v)\/[^/]+/;

export function redactAnalyticsUrl(raw: string): string {
  const url = new URL(raw);
  const path = url.pathname.replace(SECRET_PATH, "/$1/[token]");
  return url.origin + path;
}
