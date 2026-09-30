"use client";

import { usePathname } from "next/navigation";

/**
 * Where the trip's side panel goes (wide screens). Not on the Mapa page,
 * which already is the map.
 */
export function RailSlot({ tripId, children }: { tripId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith(`/viajes/${tripId}/mapa`)) return null;
  return (
    <aside
      aria-label="Resumen del viaje"
      className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-card/50 px-4 py-6 xl:flex"
    >
      {children}
    </aside>
  );
}
