"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BedDouble, ChevronRight, LogIn, LogOut, MapPin, Navigation } from "lucide-react";

import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { directionsUrl } from "@/lib/maps/directions";
import type { MapDay, MapRow } from "@/lib/maps/days";
import { importMapsLibrary, MAPS_MAP_ID, mapsConfigured } from "@/lib/maps/load";
import type { MapPoint } from "@/lib/maps/points";
import { transportMeta } from "@/lib/transportations/types";

type Props = {
  points: MapPoint[];
  days: MapDay[];
  /** Pre-selected day ("YYYY-MM-DD"), e.g. today during the trip. */
  initialDay: string | null;
};

const BED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>';
const LEAVE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>';

/** Marker content: plain DOM styled with the app's Tailwind tokens. */
function markerElement(point: MapPoint, label: string | null, leaving: boolean) {
  const el = document.createElement("div");
  if (point.kind === "stay" && leaving) {
    // The stay checked out of today: shown, but not where the day happens.
    el.className =
      "flex size-7 items-center justify-center rounded-full border-2 border-white bg-muted-foreground text-white opacity-80 shadow";
    el.innerHTML = LEAVE_SVG;
  } else if (point.kind === "stop") {
    el.className = "rounded-full border-2 border-white bg-foreground px-2.5 py-1 text-xs font-semibold text-background shadow-md";
    el.textContent = point.title;
  } else if (point.kind === "stay") {
    el.className =
      "flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary-hover text-primary-foreground shadow-md";
    el.innerHTML = BED_SVG;
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

/** Icon and colors for a timeline row, matching the itinerary. */
function rowLook(row: MapRow) {
  if (row.kind === "check_in") return { icon: LogIn, className: "bg-secondary text-primary" };
  if (row.kind === "check_out") return { icon: LogOut, className: "bg-secondary text-primary" };
  if (row.kind === "leg") return { icon: transportMeta(row.category).icon, className: "bg-secondary text-primary" };
  const meta = isCategory(row.category) ? CATEGORY_META[row.category] : CATEGORY_META.other;
  return { icon: meta.icon, className: meta.className };
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
  const dayInfo = days.find((d) => d.date === day) ?? null;

  // What's pinned: a day's stays (nights) and activities in time order, or the whole trip.
  const visible = useMemo(() => {
    if (!day) return points;
    return points
      .filter((p) => p.kind !== "stop" && p.dates.includes(day))
      .sort((a, b) => (a.kind === "stay" ? -1 : b.kind === "stay" ? 1 : (a.time ?? "").localeCompare(b.time ?? "")));
  }, [points, day]);
  // On a travel day, the stay being left: pinned (muted) but the map frames
  // tonight's city, where the day's plans are.
  const leaving = useMemo(
    () => (day ? points.filter((p) => p.kind === "stay" && p.checkOut?.date === day && !p.dates.includes(day)) : []),
    [points, day],
  );
  const dayActivities = day ? visible.filter((p) => p.kind === "activity") : [];
  const numberOf = new Map(dayActivities.map((p, i) => [p.id, String(i + 1)]));

  // Keep the selected day's chip visible in the horizontal selector.
  const selector = useRef<HTMLUListElement>(null);
  useEffect(() => {
    selector.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [day]);

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
          // One finger scrolls the page (the day's timeline is below); two fingers move the map.
          gestureHandling: "cooperative",
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

      // Frame the day's plans; the stay being left only counts if nothing else has a place.
      const framed = visible.length > 0 ? visible : leaving;
      const bounds = new google.maps.LatLngBounds();
      overlays.current.markers = [...leaving, ...visible].map((p) => {
        const isLeaving = leaving.includes(p);
        const marker = new AdvancedMarkerElement({
          map: m,
          position: { lat: p.lat, lng: p.lng },
          title: isLeaving ? `Check-out · ${p.title}` : p.title,
          content: markerElement(p, numberOf.get(p.id) ?? null, isLeaving),
          zIndex: p.kind === "stop" ? 3 : p.kind === "stay" ? 2 : 1,
          gmpClickable: true,
        });
        marker.addListener("click", () => setSelected(p.id));
        if (framed.includes(p)) bounds.extend(marker.position!);
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

      if (framed.length === 1) {
        m.setCenter(bounds.getCenter());
        m.setZoom(15);
      } else if (framed.length > 1) {
        m.fitBounds(bounds, 48);
      }
    })();
    return () => {
      cancelled = true;
    };
    // numberOf/dayActivities derive from `visible`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leaving, mapReady]);

  function chooseDay(next: string | null) {
    setDay(next);
    setSelected(null);
    // Keep the choice in the URL so a reload or a shared link opens the same day.
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("dia", next);
    else url.searchParams.delete("dia");
    window.history.replaceState(null, "", url);
  }

  function focus(pointId: string) {
    const p = points.find((x) => x.id === pointId);
    if (!p) return;
    setSelected(p.id);
    map.current?.panTo({ lat: p.lat, lng: p.lng });
    if ((map.current?.getZoom() ?? 0) < 14) map.current?.setZoom(15);
    // On a phone the list is below the map: bring the map back into view.
    container.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const current = points.find((p) => p.id === selected);
  const currentIsLeaving = current ? leaving.includes(current) : false;

  return (
    <div className="flex flex-col gap-4">
      {/* Same day selector as the itinerary, plus the whole trip. */}
      <nav aria-label="Días del viaje" className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul ref={selector} className="flex w-max gap-2">
          {[{ date: null, top: "Todo", bottom: "el viaje" }, ...days.map((d) => ({ date: d.date, top: d.dayNumber ? `Día ${d.dayNumber}` : "Fuera", bottom: d.label }))].map(
            (d) => {
              const active = d.date === day;
              return (
                <li key={d.date ?? "all"}>
                  <button
                    type="button"
                    onClick={() => chooseDay(d.date)}
                    aria-pressed={active}
                    className={
                      "flex h-14 w-20 flex-col items-center justify-center rounded-xl border text-center " +
                      (active ? "border-primary/40 bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")
                    }
                  >
                    <span className={"text-[13px] " + (active ? "font-bold" : "font-semibold")}>{d.top}</span>
                    <span className={"text-[11px] " + (active ? "" : "text-muted-foreground")}>{d.bottom}</span>
                  </button>
                </li>
              );
            },
          )}
        </ul>
      </nav>

      {/* Same day header as the itinerary: where you are and where you sleep. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {dayInfo ? `${dayInfo.dayNumber ? `Día ${dayInfo.dayNumber} · ` : ""}${dayInfo.label}` : "Todo el viaje"}
          </h2>
          {dayInfo && dayInfo.cities.length > 0 && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" />
              {dayInfo.cities.join(" → ")}
            </span>
          )}
        </div>
        {dayInfo?.tonight && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <BedDouble className="size-4 text-primary" aria-hidden="true" />
            Esta noche: <span className="font-medium text-foreground">{dayInfo.tonight}</span>
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-muted">
        {configured && !error ? (
          <div ref={container} className="h-[50vh] min-h-72 w-full scroll-mt-4" role="application" aria-label="Mapa del viaje" />
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
            <p className="font-semibold">{error ?? "El mapa aún no está configurado"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {error
                ? "Revisa la API key y sus restricciones en Google Cloud."
                : "Agrega NEXT_PUBLIC_GOOGLE_MAPS_API_KEY a .env.local y reinicia el servidor. Mientras tanto, abajo está el día."}
            </p>
          </div>
        )}

        {current && (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {currentIsLeaving ? `Check-out ${current.checkOut?.time} · ` : current.time ? `${current.time} · ` : ""}
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
            <button type="button" onClick={() => setSelected(null)} className="h-11 shrink-0 px-2 text-sm text-muted-foreground" aria-label="Cerrar">
              ✕
            </button>
          </div>
        )}
      </div>

      {dayInfo ? (
        dayInfo.rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">Nada planeado este día.</p>
        ) : (
          // The day's timeline, like the itinerary. Numbered dots match the pins.
          <ol className="relative flex flex-col gap-2">
            <span aria-hidden="true" className="absolute top-5 bottom-5 left-[13px] w-0.5 bg-timeline" />
            {dayInfo.rows.map((row) => {
              const { icon: Icon, className } = rowLook(row);
              const number = row.kind === "activity" && row.pointId ? numberOf.get(row.pointId) : undefined;
              const isSelected = row.pointId !== null && row.pointId === selected;
              const card = (
                <>
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${className}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{row.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.meta}</span>
                  </span>
                  {row.pointId ? (
                    <MapPin className="size-4 shrink-0 text-primary" aria-label="Ver en el mapa" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </>
              );
              const cardClass =
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border px-2.5 py-2 text-left hover:border-primary/40 " +
                (isSelected ? "border-primary/40 bg-secondary" : row.kind === "activity" ? "bg-card" : "border-dashed bg-secondary/40");
              return (
                <li key={row.id} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={
                      "relative flex shrink-0 items-center justify-center rounded-full font-mono font-bold " +
                      (number
                        ? "size-7 border-2 border-card bg-primary text-[11px] text-primary-foreground"
                        : "mx-2 size-3 border-2 border-primary bg-card")
                    }
                  >
                    {number}
                  </span>
                  <time className="w-11 shrink-0 font-mono text-xs font-semibold">{row.time}</time>
                  {row.pointId ? (
                    <button type="button" onClick={() => focus(row.pointId!)} aria-current={isSelected ? "true" : undefined} className={cardClass}>
                      {card}
                    </button>
                  ) : (
                    <a href={row.href} className={cardClass}>
                      {card}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        )
      ) : (
        // Whole trip: the cities and where you sleep in each.
        <ol className="flex flex-col gap-1.5">
          {points
            .filter((p) => p.kind !== "activity")
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => focus(p.id)}
                  aria-current={p.id === selected ? "true" : undefined}
                  className={
                    "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:border-primary/40 " +
                    (p.id === selected ? "border-primary/40 bg-secondary" : "bg-card")
                  }
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    {p.kind === "stay" ? <BedDouble className="size-4" aria-label="Hospedaje" /> : <MapPin className="size-4" aria-label="Ciudad" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{p.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.kind === "stay" ? p.subtitle : "Ciudad"}</span>
                  </span>
                </button>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
