"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BedDouble, MapPin, Navigation } from "lucide-react";

import { directionsUrl } from "@/lib/maps/directions";
import { importMapsLibrary, MAPS_MAP_ID, mapsConfigured } from "@/lib/maps/load";
import type { MapPoint } from "@/lib/maps/points";

type Day = { date: string; label: string; dayNumber: number | null };

type Props = {
  points: MapPoint[];
  days: Day[];
  /** Pre-selected day ("YYYY-MM-DD"), e.g. today during the trip. */
  initialDay: string | null;
};

/** Marker content: plain DOM styled with the app's Tailwind tokens. */
function markerElement(point: MapPoint, label: string | null) {
  const el = document.createElement("div");
  if (point.kind === "stop") {
    el.className =
      "rounded-full border-2 border-white bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-md";
    el.textContent = point.title;
  } else if (point.kind === "stay") {
    el.className =
      "flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary-hover text-primary-foreground shadow-md";
    el.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>';
  } else if (label) {
    el.className =
      "flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary font-mono text-xs font-bold text-primary-foreground shadow-md";
    el.textContent = label;
  } else {
    // Whole-trip view: many activities, so small dots.
    el.className = "size-3 rounded-full border-2 border-white bg-primary shadow";
  }
  return el;
}

export function TripMap({ points, days, initialDay }: Props) {
  const [day, setDay] = useState<string | null>(initialDay);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{ markers: google.maps.marker.AdvancedMarkerElement[]; line: google.maps.Polyline | null }>({
    markers: [],
    line: null,
  });
  const configured = mapsConfigured();
  // Bumped when the map finishes loading, so the drawing effect runs then.
  const [mapReady, setMapReady] = useState(0);

  // What's shown: a day's stays and activities in time order, or the whole trip.
  const visible = useMemo(() => {
    if (!day) return points;
    return points
      .filter((p) => p.kind !== "stop" && p.dates.includes(day))
      .sort((a, b) => (a.kind === "stay" ? -1 : b.kind === "stay" ? 1 : (a.time ?? "").localeCompare(b.time ?? "")));
  }, [points, day]);
  const dayActivities = day ? visible.filter((p) => p.kind === "activity") : [];
  const numberOf = new Map(dayActivities.map((p, i) => [p.id, String(i + 1)]));

  // Create the map once.
  useEffect(() => {
    if (!configured || !container.current || map.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { Map } = await importMapsLibrary("maps");
        if (cancelled || !container.current) return;
        map.current = new Map(container.current, {
          mapId: MAPS_MAP_ID,
          center: { lat: 40.4168, lng: -3.7038 },
          zoom: 5,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setMapReady((t) => t + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el mapa");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // Redraw markers and the day's route whenever the selection changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let cancelled = false;
    (async () => {
      const { AdvancedMarkerElement } = await importMapsLibrary("marker");
      const { Polyline } = await importMapsLibrary("maps");
      if (cancelled) return;

      overlays.current.markers.forEach((mk) => (mk.map = null));
      overlays.current.line?.setMap(null);

      const bounds = new google.maps.LatLngBounds();
      overlays.current.markers = visible.map((p) => {
        const marker = new AdvancedMarkerElement({
          map: m,
          position: { lat: p.lat, lng: p.lng },
          title: p.title,
          content: markerElement(p, numberOf.get(p.id) ?? null),
          zIndex: p.kind === "stop" ? 3 : p.kind === "stay" ? 2 : 1,
          gmpClickable: true,
        });
        marker.addListener("click", () => setSelected(p.id));
        bounds.extend(marker.position!);
        return marker;
      });

      // The day's route: activities in order (straight lines; real travel times come later).
      if (dayActivities.length > 1) {
        const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
        overlays.current.line = new Polyline({
          map: m,
          path: dayActivities.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeOpacity: 0,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeWeight: 3, scale: 3, strokeColor: color }, offset: "0", repeat: "14px" }],
        });
      } else {
        overlays.current.line = null;
      }

      if (visible.length === 1) {
        m.setCenter(bounds.getCenter());
        m.setZoom(15);
      } else if (visible.length > 1) {
        m.fitBounds(bounds, 48);
      }
    })();
    return () => {
      cancelled = true;
    };
    // numberOf/dayActivities derive from `visible`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mapReady]);

  function chooseDay(next: string | null) {
    setDay(next);
    setSelected(null);
    // Keep the choice in the URL so a reload or a shared link opens the same day.
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("dia", next);
    else url.searchParams.delete("dia");
    window.history.replaceState(null, "", url);
  }

  function focus(p: MapPoint) {
    setSelected(p.id);
    map.current?.panTo({ lat: p.lat, lng: p.lng });
    if ((map.current?.getZoom() ?? 0) < 14) map.current?.setZoom(15);
  }

  const current = points.find((p) => p.id === selected);
  const listed = day ? visible : points.filter((p) => p.kind !== "activity");

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Día" className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {[{ date: null, label: "Todo el viaje", dayNumber: null } as { date: string | null; label: string; dayNumber: number | null }, ...days].map((d) => {
            const active = d.date === day;
            return (
              <li key={d.date ?? "all"}>
                <button
                  type="button"
                  onClick={() => chooseDay(d.date)}
                  aria-pressed={active}
                  className={
                    "flex h-11 flex-col items-center justify-center rounded-xl border px-3 text-xs " +
                    (active ? "border-primary/40 bg-secondary font-semibold text-secondary-foreground" : "bg-card hover:bg-muted")
                  }
                >
                  {d.dayNumber ? <span className="font-semibold">Día {d.dayNumber}</span> : null}
                  <span>{d.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative overflow-hidden rounded-2xl border bg-muted">
        {configured && !error ? (
          <div ref={container} className="h-[55vh] min-h-72 w-full" role="application" aria-label="Mapa del viaje" />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
            <p className="font-semibold">{error ?? "El mapa aún no está configurado"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {error
                ? "Revisa la API key y sus restricciones en Google Cloud."
                : "Agrega NEXT_PUBLIC_GOOGLE_MAPS_API_KEY a .env.local y reinicia el servidor. Mientras tanto, abajo están los lugares."}
            </p>
          </div>
        )}

        {current && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {current.time ? `${current.time} · ` : ""}
                {current.title}
              </span>
              {current.subtitle && <span className="truncate text-xs text-muted-foreground">{current.subtitle}</span>}
            </div>
            <a
              href={directionsUrl({ lat: current.lat, lng: current.lng, google_place_id: current.placeId }) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              <Navigation className="size-4" aria-hidden="true" />
              Ir
            </a>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="h-11 shrink-0 px-2 text-sm text-muted-foreground"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {listed.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
          {day
            ? "Nada con ubicación este día. Agrega el lugar a las actividades para verlas en el mapa."
            : "Aún no hay lugares con ubicación. Busca el lugar al crear o editar actividades y hospedajes."}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {listed.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => focus(p)}
                aria-current={p.id === selected ? "true" : undefined}
                className={
                  "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:border-primary/40 " +
                  (p.id === selected ? "border-primary/40 bg-secondary" : "bg-card")
                }
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-bold text-primary">
                  {p.kind === "stay" ? (
                    <BedDouble className="size-4" aria-label="Hospedaje" />
                  ) : p.kind === "stop" ? (
                    <MapPin className="size-4" aria-label="Ciudad" />
                  ) : (
                    numberOf.get(p.id)
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{p.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[p.time, p.subtitle].filter(Boolean).join(" · ") || (p.kind === "stop" ? "Ciudad" : "")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
