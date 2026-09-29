/** Where Supabase sends the user back after Google or an email link (see app/auth/callback). */
export function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
