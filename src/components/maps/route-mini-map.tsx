"use client";

import { useEffect, useRef, useState } from "react";

import { importMapsLibrary, MAPS_MAP_ID, mapsConfigured } from "@/lib/maps/load";

type City = { id: string; name: string; lat: number; lng: number };

/**
 * A small, still map of the trip's route: cities numbered in order and joined
 * by a line. Just a glance (desktop side panel); the Mapa page is the real map.
 */
export function RouteMiniMap({ cities, current, className = "" }: { cities: City[]; current: string | null; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Primitive dependency, so a new array with the same cities doesn't redraw.
  const key = JSON.stringify(cities);

  useEffect(() => {
    if (!mapsConfigured() || !container.current) return;
    const list: City[] = JSON.parse(key);
    if (list.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { Map, Polyline } = await importMapsLibrary("maps");
        const { AdvancedMarkerElement } = await importMapsLibrary("marker");
        if (cancelled || !container.current) return;
        const map = new Map(container.current, {
          mapId: MAPS_MAP_ID,
          center: list[0],
          zoom: 5,
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          clickableIcons: false,
        });
        const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
        const bounds = new google.maps.LatLngBounds();
        list.forEach((c, i) => {
          const dot = document.createElement("span");
          dot.textContent = String(i + 1);
          dot.style.cssText = `display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;font:600 11px var(--font-geist-sans),system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.3);${
            c.id === current ? `background:${color};color:#fff;` : `background:#fff;color:${color};`
          }`;
          new AdvancedMarkerElement({ map, position: c, title: c.name, content: dot });
          bounds.extend(c);
        });
        if (list.length > 1) {
          new Polyline({ map, path: list, geodesic: true, strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2.5 });
          map.fitBounds(bounds, 28);
        } else {
          map.setZoom(11);
        }
      } catch (e) {
        console.error("Route mini map failed", e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, current]);

  if (!mapsConfigured() || failed) return null;
  return <div ref={container} role="img" aria-label={`Ruta: ${cities.map((c) => c.name).join(" → ")}`} className={className} />;
}
