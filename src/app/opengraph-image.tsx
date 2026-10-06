import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The picture WhatsApp, iMessage, Slack… show when someone shares a Travio
 * link (Open Graph). Built once at build time from this JSX; at the app root
 * so every page inherits it (an invitation link too).
 *
 * The image renderer (Satori) is not a browser: every element with more than
 * one child needs display: flex, styles are inline, and fonts must be passed
 * as files (Geist from the `geist` package, dev dependency).
 */

export const alt = "Travio: tu viaje, todo en un lugar. Itinerario, hospedajes, boletos y gastos del grupo, también sin conexión.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");

const PLANE =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

function Plane({ size: px, stroke, width = 2 }: { size: number; stroke: string; width?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={PLANE} />
    </svg>
  );
}

export default async function OpenGraphImage() {
  const [regular, semibold, bold] = await Promise.all([
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "Geist-SemiBold.ttf")),
    readFile(join(fontDir, "Geist-Bold.ttf")),
  ]);

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

          <span style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>travio-silk.vercel.app</span>
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
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
