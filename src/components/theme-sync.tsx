"use client";

import { useEffect } from "react";

import { readTheme, resolvesToDark } from "@/lib/theme";

/**
 * With "Sistema", follow the phone switching between light and dark while
 * the app is open (the inline script only runs on page load).
 */
export function ThemeSync() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const theme = readTheme();
      if (theme === "system") document.documentElement.classList.toggle("dark", resolvesToDark(theme));
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return null;
}
