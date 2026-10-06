import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { OfflineSupport } from "@/components/offline/offline-support";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travio",
  description: "Tu viaje, todo en un lugar.",
  applicationName: "Travio",
  // iPhone "Agregar a inicio": opens full screen, with this name under the icon
  // (the icon itself is app/apple-icon.png).
  appleWebApp: { capable: true, title: "Travio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // The phone's status bar: brand blue by day, the page's navy at night.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1F5EDB" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline theme script may add "dark" before React hydrates.
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Before anything paints: light or dark, from the saved choice or the phone's (src/lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <OfflineSupport />
        {children}
      </body>
    </html>
  );
}
