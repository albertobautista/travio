"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Loader2, Navigation, Plus, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { formatDuration } from "@/lib/activities/schedule";
import { directionsUrl } from "@/lib/maps/directions";
import { importMapsLibrary, mapsConfigured } from "@/lib/maps/load";
import { autoMode, distanceMeters, MARGIN_MINUTES, TRAVEL_MODE_META, type Point } from "@/lib/maps/travel";
import { formatClock, useTravelTime } from "@/lib/maps/use-travel-time";

import { suggestGapIdeas, type GapIdea, type GapIdeasResult } from "@/app/viajes/[id]/ideas/actions";

type Props = {
  tripId: string;
  fromActivityId: string;
  toActivityId: string;
  gapMinutes: number;
  /** Editors get "Agregar al itinerario". */
  editable: boolean;
};

/** Farther than this from where you start, a found place is probably the wrong one. */
const MAX_KM = 15;

type Found = GapIdea & { point: Point; address: string | null; placeId: string | null };
type Ready = Extract<GapIdeasResult, { ideas: GapIdea[] }>;

/**
 * "Tiempo libre · 3 h  ✨ ¿Qué hago?": asks the server for ideas (Claude),
 * then checks each place really exists near here (Google Places), and works
 * out whether going, staying and coming back fits in the gap.
 */
export function GapIdeas({ tripId, fromActivityId, toActivityId, gapMinutes, editable }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<GapIdeasResult | null>(null);
  const [open, setOpen] = useState(false);

  function ask() {
    setOpen(true);
    start(async () => setResult(await suggestGapIdeas(tripId, fromActivityId, toActivityId)));
  }

  return (
    <li className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2.5 pl-6 text-xs text-muted-foreground">
        <span>Tiempo libre · {formatDuration(gapMinutes)}</span>
        {!open && (
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-primary" onClick={ask}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            ¿Qué hago?
          </Button>
        )}
      </div>
      {open && (
        <section aria-label="Ideas para el tiempo libre" aria-busy={pending} className="ml-6 flex flex-col gap-2 rounded-2xl border border-primary/30 bg-secondary/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Ideas para {formatDuration(gapMinutes)}
            </h3>
            <Button type="button" size="icon" variant="ghost" className="size-9" aria-label="Cerrar ideas" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </Button>
          </div>
          {pending || !result ? (
            <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Pensando qué cabe en este hueco…
            </p>
          ) : "error" in result ? (
            <p role="alert" className="text-sm text-destructive">
              {result.error}
            </p>
          ) : (
            <IdeaList tripId={tripId} result={result} gapMinutes={gapMinutes} editable={editable} />
          )}
          <p className="text-[11px] text-muted-foreground">
            Ideas generadas con IA (Claude). Revisa horarios y precios antes de ir.
            {result && !("error" in result) && ` Te quedan ${result.remaining} hoy.`}
          </p>
        </section>
      )}
    </li>
  );
}

/** Resolves each idea to a real place, then shows the ones found. */
function IdeaList({ tripId, result, gapMinutes, editable }: { tripId: string; result: Ready; gapMinutes: number; editable: boolean }) {
  const [found, setFound] = useState<Found[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Found[] = [];
      for (const idea of result.ideas) {
        const place = await locate(idea, result.from);
        if (place) out.push({ ...idea, ...place });
      }
      if (!cancelled) setFound(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!found) {
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Comprobando los lugares…
      </p>
    );
  }
  if (found.length === 0) {
    return <p className="text-sm text-muted-foreground">No encontramos lugares verificados cerca. Prueba de nuevo más tarde.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {found.map((idea, i) => (
        <IdeaCard key={`${idea.placeName}-${i}`} tripId={tripId} idea={idea} result={result} gapMinutes={gapMinutes} editable={editable} />
      ))}
    </ol>
  );
}

/**
 * Where an idea is: a saved place already has coordinates; anything else is
 * searched in Google Places near the starting point. Not found, or too far
 * to be the place meant, and the idea is dropped (no invented places).
 */
async function locate(idea: GapIdea, from: Point | null): Promise<{ point: Point; address: string | null; placeId: string | null } | null> {
  if (idea.saved?.lat != null && idea.saved.lng != null) {
    return { point: { lat: idea.saved.lat, lng: idea.saved.lng }, address: idea.saved.address, placeId: idea.saved.placeId };
  }
  if (!mapsConfigured()) return null;
  try {
    const { Place } = await importMapsLibrary("places");
    const { places } = await Place.searchByText({
      textQuery: idea.searchQuery,
      fields: ["id", "location", "formattedAddress"],
      maxResultCount: 1,
      language: "es",
      ...(from ? { locationBias: { center: from, radius: 5_000 } } : {}),
    });
    const p = places[0];
    const loc = p?.location;
    if (!p || !loc) return null;
    const point = { lat: loc.lat(), lng: loc.lng() };
    if (from && distanceMeters(from, point) > MAX_KM * 1000) return null;
    return { point, address: p.formattedAddress ?? null, placeId: p.id ?? null };
  } catch (e) {
    console.error("Could not check idea place", idea.searchQuery, e);
    return null;
  }
}

function IdeaCard({ tripId, idea, result, gapMinutes, editable }: { tripId: string; idea: Found; result: Ready; gapMinutes: number; editable: boolean }) {
  const from = result.from ?? idea.point;
  const next = result.next ?? idea.point;
  const goMode = autoMode(from, idea.point);
  const backMode = autoMode(idea.point, next);
  const go = useTravelTime(from, idea.point, goMode, result.gapStart);
  const arriveMs = Date.parse(result.gapStart) + (go?.minutes ?? 0) * 60_000;
  const back = useTravelTime(idea.point, next, backMode, new Date(arriveMs + idea.durationMinutes * 60_000).toISOString(), Boolean(go));

  const category = isCategory(idea.category) ? CATEGORY_META[idea.category] : CATEGORY_META.other;
  const Icon = category.icon;
  const GoIcon = TRAVEL_MODE_META[goMode].icon;
  const spare = go && back ? gapMinutes - go.minutes - idea.durationMinutes - back.minutes : null;

  // Start time for the itinerary: when you'd arrive, rounded up to 5 minutes.
  const startAt = new Date(Math.ceil(arriveMs / 300_000) * 300_000);
  const addHref = (() => {
    const q = new URLSearchParams({
      dia: result.date,
      hora: formatClock(startAt, result.timeZone),
      titulo: idea.title,
      duracion: String(idea.durationMinutes),
      categoria: idea.category,
    });
    if (idea.saved) q.set("guardado", idea.saved.id);
    else {
      q.set("lugar", idea.placeName);
      if (idea.address) q.set("direccion", idea.address);
      q.set("lat", String(idea.point.lat));
      q.set("lng", String(idea.point.lng));
      if (idea.placeId) q.set("place_id", idea.placeId);
    }
    return `/viajes/${tripId}/actividades/nueva?${q}`;
  })();
  const maps = directionsUrl({ name: idea.placeName, address: idea.address, lat: idea.point.lat, lng: idea.point.lng, google_place_id: idea.placeId });

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${category.className}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-semibold leading-tight">{idea.title}</p>
          <p className="text-xs text-muted-foreground">
            {idea.saved && (
              <span className="mr-1 inline-flex items-center gap-0.5 font-medium text-primary">
                <Bookmark className="size-3" aria-hidden="true" />
                Guardado ·
              </span>
            )}
            {idea.placeName}
            {idea.address ? ` · ${idea.address}` : ""}
          </p>
          <p className="text-sm">{idea.reason}</p>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <GoIcon className="size-3.5" aria-hidden="true" />
        {go ? `${go.estimated ? "≈ " : ""}${formatDuration(go.minutes)} ${TRAVEL_MODE_META[goMode].short}` : "calculando…"}
        {" · "}
        {formatDuration(idea.durationMinutes)} allí
        {back && ` · vuelta ${formatDuration(back.minutes)} a ${result.next?.label ?? "tu siguiente plan"}`}
      </p>
      {spare !== null && (
        <p
          className={
            "text-xs font-medium " + (spare < 0 ? "text-destructive" : spare < MARGIN_MINUTES ? "text-warning-foreground" : "text-success-foreground")
          }
        >
          {spare < 0
            ? `No cabe: faltan ${formatDuration(-spare)}. Acórtalo o déjalo para otro día.`
            : spare < MARGIN_MINUTES
              ? `Cabe justo: ${formatDuration(spare)} de margen.`
              : `Cabe: te sobran ${formatDuration(spare)}.`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button asChild size="sm" className="h-9">
            <Link href={addHref}>
              <Plus aria-hidden="true" />
              Agregar al itinerario
            </Link>
          </Button>
        )}
        {maps && (
          <Button asChild size="sm" variant="outline" className="h-9">
            <a href={maps} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" />
              Cómo llegar
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
