import { ImageResponse } from "next/og";

import { geistFonts, Plane } from "@/lib/og/brand";

/**
 * The picture WhatsApp, iMessage, Slack… show when someone shares a Travio
 * link (Open Graph). Built once at build time from this JSX; at the app root
 * so every page inherits it (a one-person invitation too). Share links
 * (/v/…) and group links (/unirse/…) show the trip's own picture instead
 * (src/lib/trips/share-image.tsx).
 */

export const alt = "Travio: tu viaje, todo en un lugar. Itinerario, hospedajes, boletos y gastos del grupo, también sin conexión.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1F5EDB", fontFamily: "Geist", position: "relative", overflow: "hidden" }}>
        {/* Big faint plane in the background. */}
        <div style={{ position: "absolute", right: -120, top: -150, display: "flex", transform: "rotate(12deg)" }}>
          <Plane size={620} stroke="rgba(255,255,255,0.08)" width={1} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 64px 72px", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plane size={34} stroke="#ffffff" />
            </div>
            <span style={{ fontSize: 44, fontWeight: 700, color: "#ffffff", letterSpacing: -1.5 }}>Travio</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span style={{ fontSize: 80, fontWeight: 700, color: "#ffffff", lineHeight: 1.02, letterSpacing: -3 }}>Tu viaje, todo en un lugar.</span>
            <span style={{ fontSize: 30, color: "rgba(255,255,255,0.88)", lineHeight: 1.35 }}>
              Itinerario, hospedajes, boletos y gastos del grupo. También sin conexión.
            </span>
          </div>

          <span style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>travio.com.mx</span>
        </div>

        {/* The Hoy screen in a phone, cut off at the bottom like it's rising. */}
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 70,
            width: 360,
            height: 680,
            borderRadius: 56,
            border: "12px solid #0B1B33",
            background: "#F7F9FC",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "30px 20px",
            boxShadow: "0 40px 80px rgba(0,0,0,0.35)",
            color: "#0B1B33",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, color: "#5A6B82" }}>España 2026 · día 7 de 23</span>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>Hoy en Madrid</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", borderRadius: 22, background: "#ffffff", border: "1px solid #E3E8F0", overflow: "hidden" }}>
            <div style={{ height: 130, background: "#2C4466", display: "flex", alignItems: "flex-end", padding: "14px 16px", position: "relative" }}>
              <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 6, background: "#1F5EDB", color: "#ffffff", borderRadius: 999, padding: "4px 12px", fontSize: 14, fontWeight: 600 }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: "#ffffff" }} />
                En curso
              </div>
              <div style={{ display: "flex", flexDirection: "column", color: "#ffffff" }}>
                <span style={{ fontSize: 14, opacity: 0.8 }}>Ahora</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>Museo Reina Sofía</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#33455E" }}>
                <span>17:30 – 19:30</span>
                <span style={{ fontWeight: 600, color: "#0B1B33" }}>Termina en 12 min</span>
              </div>
              <div style={{ display: "flex", height: 7, borderRadius: 999, background: "#E3E8F0" }}>
                <div style={{ width: "88%", height: 7, borderRadius: 999, background: "#1F5EDB" }} />
              </div>
              <div style={{ height: 46, borderRadius: 12, background: "#1F5EDB", color: "#ffffff", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Ver ticket
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderRadius: 22, background: "#ffffff", border: "1px solid #E3E8F0", padding: "14px 16px" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1F5EDB" }}>Siguiente · en 47 min</span>
            <span style={{ fontSize: 19, fontWeight: 600 }}>Templo de Debod</span>
            <span style={{ fontSize: 15, color: "#5A6B82" }}>Sal a las 19:40 · 25 min en metro</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: await geistFonts(),
    },
  );
}
