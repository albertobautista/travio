import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Plus } from "lucide-react";

import { SavedPlaceCard } from "@/components/saved-places/saved-place-card";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, isCategory, type ActivityCategory } from "@/lib/activities/categories";
import { getSavedPlaces } from "@/lib/saved-places/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/guardados">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Guardados · ${trip.name} · Travio` : "Guardados · Travio" };
}

/**
 * Places worth visiting that aren't (necessarily) planned yet, by city.
 * Filters live in the URL (?ver=pendientes, ?categoria=food) so they survive
 * reloads and work without JavaScript.
 */
export default async function SavedPlacesPage({ params, searchParams }: PageProps<"/viajes/[id]/guardados">) {
  const { id } = await params;
  const { ver, categoria } = await searchParams;
  const [trip, role, stops, places] = await Promise.all([getTrip(id), getMyTripRole(id), getStops(id), getSavedPlaces(id)]);
  if (!trip) notFound();
  const editable = canEdit(role);
  const base = `/viajes/${trip.id}/guardados`;

  const onlyPending = ver === "pendientes";
  const category = typeof categoria === "string" && isCategory(categoria) ? categoria : null;
  const shown = places.filter(
    (p) => (!onlyPending || p.activities.length === 0) && (!category || p.category === category),
  );
  const pendingCount = places.filter((p) => p.activities.length === 0).length;
  const usedCategories = [...new Set(places.map((p) => p.category))].filter(isCategory) as ActivityCategory[];

  // Day to suggest when scheduling: today if you're already in that city, else its first day.
  const today = resolveTripNow(stops).today;
  const suggest = (from: string | null, to: string | null) =>
    from && from <= today && today <= (to ?? from) ? today : from;
  const groups = [
    ...stops.map((s) => ({
      key: s.id,
      name: s.name,
      suggestedDay: suggest(s.arrives_on, s.departs_on),
      places: shown.filter((p) => p.trip_stop_id === s.id),
    })),
    { key: "none", name: "Sin ciudad", suggestedDay: suggest(trip.start_date, trip.end_date), places: shown.filter((p) => !p.trip_stop_id) },
  ].filter((g) => g.places.length > 0);

  const href = (next: { ver?: string | null; categoria?: string | null }) => {
    const q = new URLSearchParams();
    const v = next.ver === undefined ? (onlyPending ? "pendientes" : null) : next.ver;
    const c = next.categoria === undefined ? category : next.categoria;
    if (v) q.set("ver", v);
    if (c) q.set("categoria", c);
    return q.size ? `${base}?${q}` : base;
  };
  const chip = (active: boolean) =>
    "flex h-9 shrink-0 items-center rounded-full px-3 text-sm " +
    (active ? "bg-primary font-semibold text-primary-foreground" : "border bg-card text-foreground/80 hover:bg-muted");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Guardados</h1>
          <p className="text-sm text-muted-foreground">Lugares por visitar, antes de decidir cuándo.</p>
        </div>
        {editable && places.length > 0 && (
          <Button asChild className="h-11 shrink-0">
            <Link href={`${base}/nuevo`}>
              <Plus aria-hidden="true" />
              Guardar
            </Link>
          </Button>
        )}
      </header>

      {places.length > 0 && (
        <nav aria-label="Filtrar" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link href={href({ ver: null })} aria-current={!onlyPending ? "page" : undefined} className={chip(!onlyPending)}>
            Todos ({places.length})
          </Link>
          <Link href={href({ ver: "pendientes" })} aria-current={onlyPending ? "page" : undefined} className={chip(onlyPending)}>
            Pendientes ({pendingCount})
          </Link>
          <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-border" />
          {usedCategories.map((c) => (
            <Link
              key={c}
              href={href({ categoria: category === c ? null : c })}
              aria-current={category === c ? "page" : undefined}
              className={chip(category === c)}
            >
              {CATEGORY_META[c].label}
            </Link>
          ))}
        </nav>
      )}

      {places.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
          <Bookmark className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">Aún no hay lugares guardados</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {editable
              ? "Guarda restaurantes, miradores o recomendaciones. Cuando decidas el día, agrégalos al itinerario con un toque."
              : "Cuando alguien guarde lugares para el viaje, aparecerán aquí."}
          </p>
          {editable && (
            <Button asChild>
              <Link href={`${base}/nuevo`}>
                <Plus aria-hidden="true" />
                Guardar un lugar
              </Link>
            </Button>
          )}
        </section>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground">
          Nada con estos filtros. <Link href={base} className="font-medium text-primary underline">Ver todos</Link>
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`city-${g.key}`} className="flex flex-col gap-3">
            <h2 id={`city-${g.key}`} className="font-semibold">
              {g.name} <span className="font-normal text-muted-foreground">({g.places.length})</span>
            </h2>
            {g.places.map((p) => (
              <SavedPlaceCard key={p.id} tripId={trip.id} place={p} editable={editable} suggestedDay={g.suggestedDay} />
            ))}
          </section>
        ))
      )}
    </main>
  );
}
