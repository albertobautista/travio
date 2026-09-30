import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ChevronLeft, ChevronRight, Pencil, Sun } from "lucide-react";

import { CityPhoto } from "@/components/maps/city-photo";
import { TripRoute } from "@/components/trips/trip-route";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { TravelerStack } from "@/components/travelers/traveler-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAccommodations } from "@/lib/accommodations/queries";
import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { activityDate, formatDayLabel } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { formatMoney } from "@/lib/budget/money";
import { plannedItems, spentItems } from "@/lib/budget/planned";
import { getExchangeRates, getExpenses } from "@/lib/budget/queries";
import { summarizeBudget } from "@/lib/budget/summary";
import { initials } from "@/lib/initials";
import { getSavedPlaces } from "@/lib/saved-places/queries";
import { createClient } from "@/lib/supabase/server";
import { getTransportations } from "@/lib/transportations/queries";
import { getTravelers } from "@/lib/travelers/queries";
import { getCoverUrls } from "@/lib/trips/cover-urls";
import { formatTripDates, getTripDayNumber, getTripLengthDays, getTripStatus } from "@/lib/trips/dates";
import { canEdit, getStops, getTrip, toTripRole } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";
import { instantToZonedTime } from "@/lib/zoned-time";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  editor: "Puede editar",
  viewer: "Solo lectura",
};

export async function generateMetadata({ params }: PageProps<"/viajes/[id]">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `${trip.name} · Travio` : "Viaje · Travio" };
}

/**
 * The trip at a glance (the "Resumen" mockup): cover, key numbers, what's
 * next, what's still missing, budget, route and people. Sections themselves
 * are one tap away in the navigation.
 */
export default async function TripPage({ params }: PageProps<"/viajes/[id]">) {
  const { id } = await params;
  const trip = await getTrip(id);

  // RLS returns nothing both when the trip doesn't exist and when the user
  // isn't a member, so we can't (and shouldn't) tell the two apart.
  if (!trip) notFound();

  const supabase = await createClient();
  const [{ data: claimsData }, { data: members }, coverUrls, stops, activities, travelers, stays, legs, saved, expenses, rates] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from("trip_members")
        .select("user_id, role, profiles (display_name, avatar_url)")
        .eq("trip_id", trip.id)
        .order("created_at"),
      getCoverUrls([trip.cover_image_path]),
      getStops(trip.id),
      getActivities(trip.id),
      getTravelers(trip.id),
      getAccommodations(trip.id),
      getTransportations(trip.id),
      getSavedPlaces(trip.id),
      getExpenses(trip.id),
      getExchangeRates(trip.id),
    ]);
  const coverUrl = trip.cover_image_path ? coverUrls.get(trip.cover_image_path) : undefined;
  const myRole = toTripRole(members?.find((m) => m.user_id === claimsData?.claims.sub)?.role);
  const editable = canEdit(myRole);
  const base = `/viajes/${trip.id}`;

  const today = resolveTripNow(stops).today;
  const status = getTripStatus(trip.start_date, trip.end_date, today);
  const days = getTripLengthDays(trip.start_date, trip.end_date);
  const dayNumber = getTripDayNumber(trip.start_date, trip.end_date, today);
  const dateLine = [
    formatTripDates(trip.start_date, trip.end_date),
    days ? (days === 1 ? "1 día" : `${days} días`) : null,
    travelers.length === 1 ? "1 viajero" : `${travelers.length} viajeros`,
  ]
    .filter(Boolean)
    .join(" · ");

  // What's next: the first activity that hasn't started (transfers aren't "plans").
  const now = new Date();
  const next = activities.find((a) => a.category !== "transfer" && new Date(a.starts_at) > now);
  const stopName = new Map(stops.map((s) => [s.id, s.name]));

  // Gaps worth a nudge while planning (editors only).
  const citiesWithoutStay = stops.filter((s) => !stays.some((a) => a.trip_stop_id === s.id));
  const pendingSaved = saved.filter((p) => p.activities.length === 0).length;
  const todo = editable
    ? [
        ...citiesWithoutStay.map((s) => ({ text: `Falta hospedaje en ${s.name}`, href: `${base}/hospedajes/nuevo?ciudad=${s.id}` })),
        ...(trip.budget_amount === null ? [{ text: "Define un presupuesto", href: `${base}/presupuesto` }] : []),
        ...(pendingSaved > 0
          ? [{ text: `${pendingSaved} ${pendingSaved === 1 ? "lugar guardado" : "lugares guardados"} sin día`, href: `${base}/guardados?ver=pendientes` }]
          : []),
      ]
    : [];

  const budget = summarizeBudget({
    tripCurrency: trip.currency,
    budgetAmount: trip.budget_amount === null ? null : Number(trip.budget_amount),
    rates,
    planned: plannedItems({ stays, legs, activities }),
    expenses: spentItems(expenses),
  });
  const spentPct = budget.budget ? Math.round((budget.spent / budget.budget) * 100) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      {/* Hero: the cover with the trip's name on it (a solid band keeps text readable on any photo). */}
      <header className={"relative overflow-hidden rounded-[20px] " + (coverUrl ? "" : "bg-primary")}>
        {coverUrl ? (
          // Plain <img>: signed URLs change on every load, so the Next image optimizer adds nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-56 w-full object-cover sm:h-64" />
        ) : (
          <div className="h-40" aria-hidden="true" />
        )}
        <Link
          href="/viajes"
          aria-label="Volver a mis viajes"
          className="absolute top-3 left-3 flex size-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow hover:bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        {editable && (
          <Link
            href={`${base}/editar`}
            className="absolute top-3 right-3 flex h-11 items-center gap-1.5 rounded-xl bg-card/90 px-3 text-sm font-semibold text-foreground shadow hover:bg-card"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </Link>
        )}
        <div className={"absolute inset-x-0 bottom-0 flex flex-col gap-1 px-4 py-3 text-white " + (coverUrl ? "bg-foreground/75" : "")}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{trip.name}</h1>
            <TripStatusBadge status={status} className="mt-1" />
          </div>
          <p className="text-sm text-white/85">{dateLine}</p>
        </div>
      </header>

      {status === "active" && (
        <Link
          href={`${base}/hoy`}
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground hover:bg-primary-hover"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
            <Sun className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">Hoy{dayNumber && days ? ` · día ${dayNumber} de ${days}` : ""}</span>
            <span className="text-sm text-white/85">Qué sigue, cómo llegar y tus reservas</span>
          </span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}

      <dl className="grid grid-cols-4 gap-2">
        <StatTile label="Días" value={days ?? "—"} />
        <StatTile label="Ciudades" value={stops.length} />
        <StatTile label="Hospedajes" value={stays.length} />
        <StatTile label="Actividades" value={activities.filter((a) => a.category !== "transfer").length} />
      </dl>

      {todo.length > 0 && (
        <section aria-labelledby="todo" className="flex flex-col gap-2 rounded-2xl border border-warning-border bg-warning-soft p-4">
          <h2 id="todo" className="flex items-center gap-2 font-semibold text-warning-foreground">
            <AlertCircle className="size-4" aria-hidden="true" />
            Por completar
          </h2>
          <ul className="flex flex-col">
            {todo.map((t) => (
              <li key={t.text}>
                <Link href={t.href} className="flex min-h-11 items-center justify-between gap-2 text-sm text-warning-foreground hover:underline">
                  {t.text}
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {next && (
        <section aria-labelledby="next" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="next" className="font-semibold">
              Próxima actividad
            </h2>
            <Link href={`${base}/itinerario`} className="text-sm text-primary hover:underline">
              Ver itinerario
            </Link>
          </div>
          {(() => {
            const cat = isCategory(next.category) ? CATEGORY_META[next.category] : CATEGORY_META.other;
            const Icon = cat.icon;
            const date = activityDate(next);
            return (
              <Link
                href={`${base}/itinerario?dia=${date}`}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40"
              >
                <span className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${cat.className}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{next.title}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {date === today ? "Hoy" : formatDayLabel(date)} · {instantToZonedTime(next.starts_at, next.timezone).time}
                    {next.trip_stop_id ? ` · ${stopName.get(next.trip_stop_id)}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            );
          })()}
        </section>
      )}

      {stops.length > 0 && (
        <section aria-labelledby="cities" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="cities" className="font-semibold">
              Ciudades
            </h2>
            <Link href={`${base}/mapa`} className="text-sm text-primary hover:underline">
              Ver mapa
            </Link>
          </div>
          <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {stops.map((s) => (
              <li key={s.id} className="flex w-28 shrink-0 flex-col gap-1">
                {/* The photo sits outside the link: its author credit is a link of its own. */}
                <CityPhoto
                  tripId={trip.id}
                  stopId={s.id}
                  name={s.name}
                  placeId={s.google_place_id}
                  lat={s.lat}
                  lng={s.lng}
                  canRemember={editable}
                  className="h-20 w-28 rounded-xl"
                />
                <Link
                  href={s.arrives_on ? `${base}/itinerario?dia=${s.arrives_on}` : `${base}/itinerario`}
                  className="flex flex-col hover:underline"
                >
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  {s.arrives_on && (
                    <span className="truncate text-xs text-muted-foreground">
                      {formatTripDates(s.arrives_on, s.departs_on, { year: false })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <TripRoute tripId={trip.id} stops={stops} editable={editable} />

      {(budget.budget !== null || budget.spent > 0) && (
        <Link href={`${base}/presupuesto`} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">Presupuesto</span>
            {spentPct !== null && <span className="text-sm text-muted-foreground">{spentPct}% gastado</span>}
          </span>
          <span className="font-mono text-2xl font-bold">
            {formatMoney(budget.budget ?? budget.spent, trip.currency)} <span className="text-sm font-normal text-muted-foreground">{trip.currency}</span>
          </span>
          {spentPct !== null && (
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span
                className={"block h-full rounded-full " + (spentPct > 100 ? "bg-destructive" : "bg-success")}
                style={{ width: `${Math.min(100, spentPct)}%` }}
              />
            </span>
          )}
        </Link>
      )}

      <Link
        href={`${base}/viajeros`}
        className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">Viajeros ({travelers.length})</span>
          <span className="truncate text-sm text-muted-foreground">
            {travelers.length === 0 ? "Agrega a quienes van al viaje" : travelers.map((t) => t.name).join(", ")}
          </span>
        </span>
        {travelers.length > 0 && <TravelerStack travelers={travelers} />}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      {trip.description && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Notas</h2>
          <p className="whitespace-pre-line text-foreground/80">{trip.description}</p>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">Acceso al viaje ({members?.length ?? 0})</h2>
          <p className="text-xs text-muted-foreground">Cuentas de Travio que pueden ver o editar este viaje.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {members?.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar>
                {m.profiles?.avatar_url && <AvatarImage src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback>{initials(m.profiles?.display_name)}</AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {m.profiles?.display_name ?? "Sin nombre"}
                  {m.user_id === claimsData?.claims.sub ? " (tú)" : ""}
                </span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {myRole === "viewer" && <p className="text-center text-sm text-muted-foreground">Tienes acceso de solo lectura a este viaje.</p>}
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border bg-card px-1 py-3 text-center">
      <dt className="order-2 truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl font-bold">{value}</dd>
    </div>
  );
}
