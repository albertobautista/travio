import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The service worker: always check for a new version (browsers would
        // otherwise keep using an old one), and only ever run it from here.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // Only limits what scripts the worker may load. Not default-src: a
          // service worker's CSP also applies to its own fetches, and it must
          // reach Supabase Storage (documents, covers).
          { key: "Content-Security-Policy", value: "script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
