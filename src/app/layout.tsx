import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { OfflineSupport } from "@/components/offline/offline-support";

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
  themeColor: "#1F5EDB",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OfflineSupport />
        {children}
      </body>
    </html>
  );
}
