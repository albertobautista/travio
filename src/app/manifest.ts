import type { MetadataRoute } from "next";

/**
 * Web app manifest (served at /manifest.webmanifest): what makes Travio
 * installable. Android offers "Instalar"; on iPhone it's Safari → Compartir →
 * "Agregar a inicio" (Safari also reads the apple-* metadata in the root layout).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travio",
    short_name: "Travio",
    description: "Tu viaje, todo en un lugar.",
    lang: "es",
    start_url: "/viajes",
    scope: "/",
    display: "standalone",
    // Page background (--background) while the app opens, and the system bar color.
    background_color: "#F7F9FC",
    theme_color: "#1F5EDB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed version: Android crops it into a circle, squircle…
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
