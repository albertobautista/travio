/**
 * Light / dark mode. The choice lives in a cookie on this device ("system"
 * when unset); the .dark class on <html> is what the CSS reads (globals.css).
 *
 * The class is set by a tiny inline script before the page paints
 * (THEME_SCRIPT, in the root layout), so there's no white flash on a dark
 * phone. Reading the cookie on the server instead would make every page
 * dynamic, and "system" can only be resolved in the browser anyway.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

/** Runs inline in <head>, before anything renders. Keep it tiny and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

/** The saved choice, in the browser. */
export function readTheme(): Theme {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`));
  return m && isTheme(m[1]) ? m[1] : "system";
}

/** Is the page showing dark right now for this choice? */
export function resolvesToDark(theme: Theme) {
  return theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Save the choice (one year, this device) and apply it right away. */
export function applyTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.classList.toggle("dark", resolvesToDark(theme));
  window.dispatchEvent(new Event("travio-theme"));
}

/** Google Maps takes its own setting when a map is created. */
export function mapColorScheme(): "DARK" | "LIGHT" {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "DARK" : "LIGHT";
}
