"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BedDouble, Bookmark, CalendarPlus, ChevronRight, Eye, EyeOff, LogIn, LogOut, MapPin, Navigation, ZoomIn } from "lucide-react";

import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { directionsUrl } from "@/lib/maps/directions";
import type { MapCity, MapDay, MapRow } from "@/lib/maps/days";
import { importMapsLibrary, MAPS_MAP_ID, mapsConfigured } from "@/lib/maps/load";
import { mapColorScheme } from "@/lib/theme";
import type { MapPoint } from "@/lib/maps/points";
import { transportMeta } from "@/lib/transportations/types";
import { WeatherChip } from "@/components/weather/weather-chip";
import { weatherMeta, WEATHER_ATTRIBUTION } from "@/lib/weather/types";

type Props = {
  tripId: string;
  editable: boolean;
  points: MapPoint[];
  days: MapDay[];
  /** The route of cities, for the whole-trip view. */
  cities: MapCity[];
  /** Pre-selected day ("YYYY-MM-DD"), e.g. today during the trip. */
  initialDay: string | null;
};

const BED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>';
const BOOKMARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>';
const LEAVE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>';

/** Zoom at which a city's hotels and activities appear in the whole-trip view. */
const CITY_ZOOM = 11;

type LatLng = { lat: number; lng: number };

/** Nothing in the trip has a place yet: the whole world, not some default country. */
const WORLD = { center: { lat: 20, lng: 0 }, zoom: 2 };

/** Center on one place or fit several; false if there is nothing to frame. */
function frame(m: google.maps.Map, places: LatLng[], zoomForOne: number, padding: number) {
  if (places.length === 0) return false;
  if (places.length === 1) {
    m.setCenter(places[0]);
    m.setZoom(zoomForOne);
  } else {
    const bounds = new google.maps.LatLngBounds();
    places.forEach((pl) => bounds.extend(pl));
    m.fitBounds(bounds, padding);
  }
  return true;
}

/** Marker content: plain DOM styled with the app's Tailwind tokens. */
function markerElement(point: MapPoint, label: string | null, leaving: boolean) {
  const el = document.createElement("div");
  if (point.kind === "saved") {
    // Saved for later: hollow, so it reads as "option", not "plan".
    el.className =
      "flex size-7 items-center justify-center rounded-full border-2 border-primary bg-card text-primary shadow";
    el.innerHTML = BOOKMARK_SVG;
  } else if (point.kind === "stay" && leaving) {
    // The stay checked out of today: shown, but not where the day happens.
    el.className =
      "flex size-7 items-center justify-center rounded-full border-2 border-white bg-muted-foreground text-white opacity-80 shadow";
    el.innerHTML = LEAVE_SVG;
  } else if (point.kind === "stop") {
    // "① Barcelona": the city's place in the route.
    el.className =
      "flex items-center gap-1.5 rounded-full border-2 border-white bg-foreground py-1 pr-2.5 pl-1 text-xs font-semibold text-background shadow-md";
    const n = document.createElement("span");
    n.className = "flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground";
    n.textContent = label ?? "";
    el.append(n, document.createTextNode(point.title));
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

export function TripMap({ tripId, editable, points, days, cities, initialDay }: Props) {
  const [day, setDay] = useState<string | null>(initialDay);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{
    markers: google.maps.marker.AdvancedMarkerElement[];
    lines: google.maps.Polyline[];
    zoomListener: google.maps.MapsEventListener | null;
  }>({ markers: [], lines: [], zoomListener: null });
  const configured = mapsConfigured();
  // Bumped when the map finishes loading, so the drawing effect runs then.
  const [mapReady, setMapReady] = useState(0);
  const dayInfo = days.find((d) => d.date === day) ?? null;
  // Where the trip is: its cities, or failing that anything with a place.
  const locatedCities = useMemo(
    () => cities.flatMap((c) => (c.lat !== null && c.lng !== null ? [{ id: c.id, lat: c.lat, lng: c.lng }] : [])),
    [cities],
  );
  const home: LatLng[] = locatedCities.length > 0 ? locatedCities : points;

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
  // Saved places not planned yet in the day's city (or cities): ideas for free time.
  const [showSaved, setShowSaved] = useState(true);
  const nearbySaved = useMemo(
    () => (dayInfo ? points.filter((p) => p.kind === "saved" && p.stopId !== null && dayInfo.stopIds.includes(p.stopId)) : []),
    [points, dayInfo],
  );
  const dayActivities = day ? visible.filter((p) => p.kind === "activity") : [];
  const numberOf = new Map(dayActivities.map((p, i) => [p.id, String(i + 1)]));
  const cityOrder = new Map(cities.map((c) => [c.id, String(c.order)]));

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
          colorScheme: mapColorScheme(),
          // Start where the trip is (the drawing effect frames it precisely).
          center: home[0] ? { lat: home[0].lat, lng: home[0].lng } : WORLD.center,
          zoom: home[0] ? 10 : WORLD.zoom,
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
    // `home` only sets the first view; later framing happens when drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      overlays.current.lines.forEach((l) => l.setMap(null));
      overlays.current.zoomListener?.remove();
      overlays.current.lines = [];
      overlays.current.zoomListener = null;
      const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();

      if (!day) {
        // Whole trip: cities numbered in route order, joined by how you travel.
        // Hotels and activities only appear once you zoom into a city.
        const detail: google.maps.marker.AdvancedMarkerElement[] = [];
        overlays.current.markers = points.map((p) => {
          const marker = new AdvancedMarkerElement({
            map: p.kind === "stop" || (m.getZoom() ?? 0) >= CITY_ZOOM ? m : null,
            position: { lat: p.lat, lng: p.lng },
            title: p.title,
            content: markerElement(p, p.kind === "stop" ? (cityOrder.get(p.id) ?? null) : null, false),
            zIndex: p.kind === "stop" ? 3 : p.kind === "stay" ? 2 : 1,
            gmpClickable: true,
          });
          marker.addListener("click", () => (p.kind === "stop" ? focusCity(p.id) : setSelected(p.id)));
          if (p.kind !== "stop") detail.push(marker);
          return marker;
        });
        const cityLabels = overlays.current.markers.filter((mk) => !detail.includes(mk));
        const applyZoom = () => {
          // No city has a place: its hotels and activities are all there is to show.
          const show = (m.getZoom() ?? 0) >= CITY_ZOOM || locatedCities.length === 0;
          detail.forEach((mk) => (mk.map = show ? m : null));
          // Zoomed into a city, its label goes under the places instead of covering them.
          cityLabels.forEach((mk) => (mk.zIndex = show ? 0 : 3));
        };
        overlays.current.zoomListener = m.addListener("zoom_changed", applyZoom);

        const located = cities.filter((c) => c.lat !== null && c.lng !== null);
        applyZoom();
        overlays.current.lines = located.slice(1).map((c, i) => {
          const from = located[i];
          // Flights: dashed arcs (geodesic). Trains, buses, ferries: solid lines.
          const flight = (from.leaveBy?.type ?? c.arriveBy?.type) === "flight";
          return new Polyline({
            map: m,
            path: [
              { lat: from.lat!, lng: from.lng! },
              { lat: c.lat!, lng: c.lng! },
            ],
            geodesic: flight,
            strokeColor: color,
            strokeOpacity: flight ? 0 : 0.7,
            strokeWeight: 3,
            icons: flight
              ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeWeight: 3, scale: 3, strokeColor: color }, offset: "0", repeat: "14px" }]
              : undefined,
          });
        });

        if (!frame(m, home, located.length > 0 ? 12 : 14, 64)) {
          m.setCenter(WORLD.center);
          m.setZoom(WORLD.zoom);
        }
        return;
      }

      // Frame the day's plans; the stay being left only counts if nothing else has a place.
      const framed = visible.length > 0 ? visible : leaving;
      const savedShown = showSaved ? nearbySaved : [];
      overlays.current.markers = [...savedShown, ...leaving, ...visible].map((p) => {
        const isLeaving = leaving.includes(p);
        const marker = new AdvancedMarkerElement({
          map: m,
          position: { lat: p.lat, lng: p.lng },
          title: isLeaving ? `Check-out · ${p.title}` : p.title,
          content: markerElement(p, numberOf.get(p.id) ?? null, isLeaving),
          zIndex: p.kind === "stop" ? 3 : p.kind === "stay" ? 2 : p.kind === "saved" ? 0 : 1,
          gmpClickable: true,
        });
        marker.addListener("click", () => setSelected(p.id));
        return marker;
      });

      // The day's route: activities in order (straight lines; real travel times come later).
      if (dayActivities.length > 1) {
        overlays.current.lines = [
          new Polyline({
            map: m,
            path: dayActivities.map((p) => ({ lat: p.lat, lng: p.lng })),
            strokeOpacity: 0,
            icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeWeight: 3, scale: 3, strokeColor: color }, offset: "0", repeat: "14px" }],
          }),
        ];
      }

      // Saved places are ideas nearby: they don't pull the frame away from the day's plans.
      // Nothing placed that day: show the day's city, else the trip, never a default country.
      const dayCities = locatedCities.filter((c) => dayInfo?.stopIds.includes(c.id));
      if (!frame(m, framed, 15, 48) && !frame(m, dayCities, 12, 64) && !frame(m, home, 12, 64)) {
        m.setCenter(WORLD.center);
        m.setZoom(WORLD.zoom);
      }
    })();
    return () => {
      cancelled = true;
    };
    // numberOf/dayActivities derive from `visible`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leaving, day, nearbySaved, showSaved, mapReady]);

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

  /** Zoom into a city so its hotels and activities show. */
  function focusCity(cityId: string) {
    const m = map.current;
    const city = cities.find((c) => c.id === cityId);
    if (!m || !city) return;
    setSelected(null);
    // Frame the plans (hotel and activities); saved places far out of town would widen it.
    const inside = points.filter((p) => (p.kind === "activity" || p.kind === "stay") && p.stopId === cityId);
    if (inside.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      inside.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      m.fitBounds(bounds, 48);
    } else if (city.lat !== null && city.lng !== null) {
      m.setCenter({ lat: city.lat, lng: city.lng });
      m.setZoom(13);
    }
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
        {dayInfo?.weather && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <WeatherChip
              code={dayInfo.weather.code}
              max={dayInfo.weather.max}
              min={dayInfo.weather.min}
              rainChance={dayInfo.weather.rainChance}
              typical={dayInfo.weather.kind === "typical"}
            />
            <a href={WEATHER_ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] hover:underline">
              {WEATHER_ATTRIBUTION.label}
            </a>
          </p>
        )}
        {dayInfo?.tonight && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <BedDouble className="size-4 text-primary" aria-hidden="true" />
            Esta noche: <span className="font-medium text-foreground">{dayInfo.tonight}</span>
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-muted">
        {configured && !error ? (
          <div ref={container} className="h-[50vh] min-h-72 w-full scroll-mt-4 lg:h-[62vh]" role="application" aria-label="Mapa del viaje" />
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
                {current.kind === "saved" ? "Guardado · " : currentIsLeaving ? `Check-out ${current.checkOut?.time} · ` : current.time ? `${current.time} · ` : ""}
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
        // Whole trip: one card per city, in route order.
        <ol className="flex flex-col gap-3">
          {cities.map((c) => {
            const In = c.arriveBy ? transportMeta(c.arriveBy.type).icon : null;
            const Out = c.leaveBy ? transportMeta(c.leaveBy.type).icon : null;
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                    {c.order}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="text-lg leading-tight font-bold">{c.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[c.dates, c.nights ? (c.nights === 1 ? "1 noche" : `${c.nights} noches`) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                <ul className="flex flex-col gap-1.5 text-sm">
                  {In && c.arriveBy && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <In className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="sr-only">Llegas: </span>
                      <span className="truncate">{c.arriveBy.text}</span>
                    </li>
                  )}
                  {c.stays.length > 0 && (
                    <li className="flex items-center gap-2">
                      <BedDouble className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate font-medium">{c.stays.join(" · ")}</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {c.activityCount === 1 ? "1 actividad" : `${c.activityCount} actividades`}
                  </li>
                  {c.weather && (
                    <li className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                      <WeatherChip code={c.weather.code} max={c.weather.max} min={c.weather.min} typical={c.weather.kind === "typical"} />
                      <span className="text-xs">
                        {weatherMeta(c.weather.code).label}
                        {c.weather.rainyDays > 0
                          ? ` · lluvia probable ${c.weather.rainyDays === 1 ? "1 día" : `${c.weather.rainyDays} días`}`
                          : ""}
                      </span>
                    </li>
                  )}
                  {Out && c.leaveBy && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Out className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="sr-only">Te vas: </span>
                      <span className="truncate">{c.leaveBy.text}</span>
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                    </li>
                  )}
                </ul>

                <div className="flex flex-wrap items-center gap-2">
                  {c.lat !== null && (
                    <button
                      type="button"
                      onClick={() => focusCity(c.id)}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                    >
                      <ZoomIn className="size-4" aria-hidden="true" />
                      Ver en el mapa
                    </button>
                  )}
                  {c.days.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => chooseDay(d.date)}
                      className="flex h-9 items-center rounded-full border bg-card px-3 text-sm text-foreground/80 hover:bg-muted"
                    >
                      {d.dayNumber ? `Día ${d.dayNumber}` : d.date}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {dayInfo && nearbySaved.length > 0 && (
        <section aria-labelledby="nearby-saved" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="nearby-saved" className="flex items-center gap-1.5 font-semibold">
              <Bookmark className="size-4 text-primary" aria-hidden="true" />
              Guardados en {dayInfo.cities.join(" y ")} ({nearbySaved.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowSaved((v) => !v)}
              aria-pressed={showSaved}
              className="flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-xs text-foreground/80 hover:bg-muted"
            >
              {showSaved ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
              {showSaved ? "En el mapa" : "Ocultos"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Ideas para un rato libre: aún no están en el itinerario.</p>
          <ul className="flex flex-col gap-1.5">
            {nearbySaved.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaved(true);
                    focus(p.id);
                  }}
                  aria-current={p.id === selected ? "true" : undefined}
                  className={
                    "flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed px-3 py-2 text-left hover:border-primary/40 " +
                    (p.id === selected ? "border-primary/40 bg-secondary" : "bg-card")
                  }
                >
                  <Bookmark className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{p.title}</span>
                    {p.subtitle && <span className="truncate text-xs text-muted-foreground">{p.subtitle}</span>}
                  </span>
                </button>
                {editable && (
                  <Link
                    href={`/viajes/${tripId}/actividades/nueva?guardado=${p.id}&dia=${dayInfo.date}`}
                    aria-label={`Agregar ${p.title} a este día`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover"
                  >
                    <CalendarPlus className="size-5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
