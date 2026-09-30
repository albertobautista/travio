import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BedDouble, ChevronRight, LogIn, LogOut, MapPin, Plus } from "lucide-react";

import { TravelerAvatar, TravelerStack } from "@/components/travelers/traveler-avatar";
import { Button } from "@/components/ui/button";
import { getAccommodations } from "@/lib/accommodations/queries";
import { stayEvents } from "@/lib/accommodations/stays";
import { formatLegTimes, legMinutes, legTimes } from "@/lib/transportations/legs";
import { getTransportations } from "@/lib/transportations/queries";
import { legEndTitle, legRoute, transportMeta } from "@/lib/transportations/types";
import { BOOKING_META, CATEGORY_META, isBookingStatus, isCategory } from "@/lib/activities/categories";
import { activityDate, buildItineraryDays, pickDay } from "@/lib/activities/itinerary";
import { getActivities } from "@/lib/activities/queries";
import { findConflicts, formatDuration, formatTimeRange } from "@/lib/activities/schedule";
import { getTravelers } from "@/lib/travelers/queries";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { stopsForDate } from "@/lib/trips/stops";
import { todayIn } from "@/lib/trips/dates";
import { getDailyWeather } from "@/lib/weather/open-meteo";
import { WeatherChip } from "@/components/weather/weather-chip";
import { WEATHER_ATTRIBUTION } from "@/lib/weather/types";
import { resolveTripNow } from "@/lib/trips/today";
import { instantToZonedTime } from "@/lib/zoned-time";
import { TravelGap } from "@/components/activities/travel-gap";
import { isTravelMode, travelPairs } from "@/lib/maps/travel";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/itinerario">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Itinerario · ${trip.name} · Travio` : "Itinerario · Travio" };
}

export default async function ItineraryPage({ params, searchParams }: PageProps<"/viajes/[id]/itinerario">) {
  const { id } = await params;
  const { dia, persona } = await searchParams;
  const [trip, role, stops, activities, travelers, stays, legs] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getTravelers(id),
    getAccommodations(id),
    getTransportations(id),
  ]);
  if (!trip) notFound();

  const editable = canEdit(role);
  const travelerById = new Map(travelers.map((t) => [t.id, t]));
  // ?persona= shows one traveler's itinerary: activities with nobody listed
  // (everyone) or with them listed.
  const person = typeof persona === "string" ? travelerById.get(persona) : undefined;

  const withDates = activities
    .map((a) => ({
      ...a,
      date: activityDate(a),
      startsAt: new Date(a.starts_at),
      participantIds: a.activity_participants.map((p) => p.traveler_id),
    }))
    .filter((a) => !person || a.participantIds.length === 0 || a.participantIds.includes(person.id));
  const days = buildItineraryDays(trip, withDates.map((a) => a.date));
  // "Today" where the travelers are (their current city's time zone).
  const day = pickDay(days, typeof dia === "string" ? dia : undefined, resolveTripNow(stops).today);

  // Conflicts across the whole trip: an overnight activity can overlap the next
  // day. Only activities that share a traveler can clash.
  // Transportation counts too: nobody can be at a museum during their flight.
  // Except car rentals: having the car for two days doesn't block anything.
  const personLegs = legs.filter((l) => {
    const ids = l.transportation_participants.map((p) => p.traveler_id);
    return !person || ids.length === 0 || ids.includes(person.id);
  });
  const conflicts = findConflicts([
    ...withDates.map((a) => ({
      id: a.id,
      title: a.title,
      startsAt: a.startsAt,
      durationMinutes: a.duration_minutes,
      participantIds: a.participantIds,
    })),
    ...personLegs.filter((l) => l.type !== "car_rental").map((l) => ({
      id: l.id,
      title: `${transportMeta(l.type).label} ${legRoute(l)}`,
      startsAt: new Date(l.departs_at),
      durationMinutes: legMinutes(l),
      participantIds: l.transportation_participants.map((p) => p.traveler_id),
    })),
  ]);
  const dayActivities = day ? withDates.filter((a) => a.date === day.date) : [];

  // Stays: check-in/check-out are derived events in the timeline (not stored
  // as activities), and the day header says where the night is spent.
  const personStays = stays.filter((s) => {
    const ids = s.accommodation_participants.map((p) => p.traveler_id);
    return !person || ids.length === 0 || ids.includes(person.id);
  });
  const events = stayEvents(personStays);
  const dayEvents = day ? events.filter((e) => e.date === day.date) : [];
  // The night of `day` belongs to the stay checked into on or before it and left after it.
  const tonight = day
    ? personStays.find(
        (s) =>
          instantToZonedTime(s.check_in_at, s.timezone).date <= day.date &&
          day.date < instantToZonedTime(s.check_out_at, s.timezone).date,
      )
    : undefined;
  // Legs show at departure; an arrival on a later local date gets its own row that day.
  const dayLegs = day
    ? personLegs.flatMap((l) => {
        const { departs, arrives } = legTimes(l);
        const out: { leg: typeof l; end: "departs" | "arrives"; at: Date; time: string }[] = [];
        if (departs.date === day.date) out.push({ leg: l, end: "departs", at: new Date(l.departs_at), time: departs.time });
        if (arrives.date === day.date && arrives.date !== departs.date) {
          out.push({ leg: l, end: "arrives", at: new Date(l.arrives_at), time: arrives.time });
        }
        return out;
      })
    : [];
  type Row =
    | { kind: "activity"; at: Date; activity: (typeof dayActivities)[number] }
    | { kind: "stay"; at: Date; event: (typeof dayEvents)[number] }
    | { kind: "leg"; at: Date; item: (typeof dayLegs)[number] };
  const dayRows: Row[] = [
    ...dayActivities.map((a): Row => ({ kind: "activity", at: a.startsAt, activity: a })),
    ...dayEvents.map((e): Row => ({ kind: "stay", at: e.at, event: e })),
    ...dayLegs.map((item): Row => ({ kind: "leg", at: item.at, item })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  // Travel time to check between consecutive activities (anything else in between breaks the chain).
  const travelTo = new Map(
    travelPairs(
      dayRows.map((row) =>
        row.kind === "activity"
          ? {
              id: row.activity.id,
              category: row.activity.category,
              start: row.activity.startsAt,
              end: new Date(row.activity.startsAt.getTime() + row.activity.duration_minutes * 60_000),
              point: row.activity.lat !== null && row.activity.lng !== null ? { lat: row.activity.lat, lng: row.activity.lng } : null,
              participantIds: row.activity.participantIds,
            }
          : null,
      ),
    ).map((pair) => [pair.to.id, pair]),
  );
  const dayStops = day ? stopsForDate(stops, day.date) : [];
  // Weather where the day ends up (the destination on a travel day).
  const weatherStop = [...dayStops].reverse().find((s) => s.lat !== null && s.lng !== null);
  const weather =
    day && weatherStop
      ? (
          await getDailyWeather(
            { lat: weatherStop.lat!, lng: weatherStop.lng!, timezone: weatherStop.timezone },
            day.date,
            day.date,
            todayIn(weatherStop.timezone),
          )
        ).get(day.date)
      : undefined;
  const addHref = `/viajes/${trip.id}/actividades/nueva${day ? `?dia=${day.date}` : ""}`;
  const itineraryHref = (params: { dia?: string; persona?: string | null }) => {
    const q = new URLSearchParams();
    const d = params.dia ?? day?.date;
    const p = params.persona === undefined ? person?.id : params.persona;
    if (d) q.set("dia", d);
    if (p) q.set("persona", p);
    return `/viajes/${trip.id}/itinerario${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Itinerario</h1>
          <p className="truncate text-sm text-muted-foreground lg:hidden">{trip.name}</p>
        </div>
        {editable && (
          <Button asChild size="icon-lg" className="size-11 rounded-xl">
            <Link href={addHref} aria-label="Agregar actividad">
              <Plus className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </header>

      {travelers.length > 1 && (
        <nav aria-label="Ver el itinerario de" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-2">
            <li>
              <Link
                href={itineraryHref({ persona: null })}
                aria-current={!person ? "page" : undefined}
                className={
                  "flex h-9 items-center rounded-full px-3 text-sm " +
                  (!person ? "bg-primary font-semibold text-primary-foreground" : "border bg-card text-foreground/80 hover:bg-muted")
                }
              >
                Todos
              </Link>
            </li>
            {travelers.map((t) => {
              const active = person?.id === t.id;
              return (
                <li key={t.id}>
                  <Link
                    href={itineraryHref({ persona: t.id })}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex h-9 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm " +
                      (active ? "bg-primary font-semibold text-primary-foreground" : "border bg-card text-foreground/80 hover:bg-muted")
                    }
                  >
                    <TravelerAvatar traveler={t} size="sm" />
                    {t.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-muted-foreground">
            Aún no hay actividades. {trip.start_date ? "" : "Agrega fechas al viaje para ver cada día."}
          </p>
          {editable && (
            <Button asChild size="lg">
              <Link href={addHref}>Agregar actividad</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <nav aria-label="Días del viaje" className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {days.map((d) => {
                const active = d.date === day?.date;
                return (
                  <li key={d.date}>
                    <Link
                      href={itineraryHref({ dia: d.date })}
                      aria-current={active ? "date" : undefined}
                      className={
                        "flex h-14 w-20 flex-col items-center justify-center rounded-xl border text-center " +
                        (active ? "border-primary/40 bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted")
                      }
                    >
                      <span className={"text-[13px] " + (active ? "font-bold" : "font-semibold")}>
                        {d.dayNumber ? `Día ${d.dayNumber}` : "Fuera"}
                      </span>
                      <span className={"text-[11px] " + (active ? "" : "text-muted-foreground")}>{d.label}</span>
                      {d.activityCount > 0 && <span className="sr-only">, {d.activityCount} actividades</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {day && (
            <section aria-labelledby="day-heading" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="day-heading" className="text-lg font-semibold">
                  {day.dayNumber ? `Día ${day.dayNumber} · ` : ""}
                  {day.label}
                </h2>
                {dayStops.length > 0 && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {dayStops.map((s) => s.name).join(" → ")}
                  </span>
                )}
              </div>
              {weather && (
                <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <WeatherChip
                    code={weather.code}
                    max={weather.max}
                    min={weather.min}
                    rainChance={weather.rainChance}
                    typical={weather.kind === "typical"}
                  />
                  {dayStops.length > 1 && <span className="text-xs">en {weatherStop!.name}</span>}
                  <a href={WEATHER_ATTRIBUTION.href} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] hover:underline">
                    {WEATHER_ATTRIBUTION.label}
                  </a>
                </p>
              )}
              {tonight && (
                <Link
                  href={`/viajes/${trip.id}/hospedajes`}
                  className="-mt-1 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <BedDouble className="size-4 text-primary" aria-hidden="true" />
                  Esta noche: <span className="font-medium text-foreground">{tonight.name}</span>
                </Link>
              )}

              {dayRows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
                  <p className="text-sm text-muted-foreground">Nada planeado este día.</p>
                  {editable && (
                    <Button asChild>
                      <Link href={addHref}>
                        <Plus aria-hidden="true" />
                        Agregar actividad
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <ol className="relative flex flex-col gap-2.5">
                  <span aria-hidden="true" className="absolute top-5 bottom-5 left-[5px] w-0.5 bg-timeline" />
                  {dayRows.map((row) => {
                    if (row.kind === "leg") {
                      const { leg, end, at, time } = row.item;
                      const meta = transportMeta(leg.type);
                      const Icon = meta.icon;
                      const booking = isBookingStatus(leg.booking_status) ? BOOKING_META[leg.booking_status] : null;
                      const overlaps = conflicts.get(leg.id) ?? [];
                      const service = [leg.carrier, leg.service_number].filter(Boolean).join(" ");
                      return (
                        <li key={`${leg.id}-${end}`} className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={"relative size-3 shrink-0 rounded-full border-2 border-card " + (overlaps.length > 0 ? "bg-warning" : "bg-primary")}
                          />
                          <time dateTime={at.toISOString()} className="w-11 shrink-0 font-mono text-xs font-semibold">
                            {time}
                          </time>
                          <Link
                            href={`/viajes/${trip.id}/transporte${editable ? `/${leg.id}` : ""}`}
                            className={
                              "flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border px-2.5 py-2 hover:border-primary/40 " +
                              (overlaps.length > 0 ? "border-warning-border bg-warning-soft" : "bg-card")
                            }
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-primary">
                                <Icon className="size-5" aria-hidden="true" />
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-semibold">
                                  {legEndTitle(leg, end)}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {formatLegTimes(leg)}
                                  {service ? ` · ${service}` : ""}
                                  {end === "departs" && leg.departure_detail ? ` · ${leg.departure_detail}` : ""}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                                    {meta.label}
                                  </span>
                                  {booking?.badge && (
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${booking.className}`}>
                                      {booking.badge}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </span>
                            {overlaps.length > 0 && (
                              <span className="flex items-start gap-2 text-xs text-warning-foreground">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                {overlaps.map((o) => `Se solapa ${formatDuration(o.overlapMinutes)} con ${o.title}`).join(". ")}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    }
                    if (row.kind === "stay") {
                      const { event } = row;
                      const Icon = event.kind === "check_in" ? LogIn : LogOut;
                      return (
                        <li key={`${event.stay.id}-${event.kind}`} className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="relative size-3 shrink-0 rounded-full border-2 border-primary bg-card" />
                          <time dateTime={event.at.toISOString()} className="w-11 shrink-0 font-mono text-xs font-semibold">
                            {event.time}
                          </time>
                          <Link
                            href={`/viajes/${trip.id}/hospedajes`}
                            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] border border-dashed bg-secondary/40 px-2.5 py-2 hover:border-primary/40"
                          >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-primary">
                              <Icon className="size-5" aria-hidden="true" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-semibold">
                                {event.kind === "check_in" ? "Check-in" : "Check-out"} · {event.stay.name}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {event.stay.address ?? "Hospedaje"}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    }
                    const a = row.activity;
                    const category = isCategory(a.category) ? CATEGORY_META[a.category] : CATEGORY_META.other;
                    const booking = isBookingStatus(a.booking_status) ? BOOKING_META[a.booking_status] : null;
                    const overlaps = conflicts.get(a.id) ?? [];
                    const Icon = category.icon;
                    const href = `/viajes/${trip.id}/actividades/${a.id}`;
                    const card = (
                      <>
                        <span className="flex items-center gap-2.5">
                          <span className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] ${category.className}`}>
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-semibold">{a.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatTimeRange(a.startsAt, a.duration_minutes, a.timezone)} · {formatDuration(a.duration_minutes)}
                              {a.location_name ? ` · ${a.location_name}` : ""}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${category.className}`}>
                                {category.label}
                              </span>
                              {booking?.badge && (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${booking.className}`}>
                                  {booking.badge}
                                </span>
                              )}
                              {/* No participant rows means everyone goes, so show every traveler. */}
                              {travelers.length > 0 && (
                                <span className="ml-auto">
                                  <TravelerStack
                                    travelers={
                                      a.participantIds.length > 0
                                        ? a.participantIds.flatMap((pid) => travelerById.get(pid) ?? [])
                                        : travelers
                                    }
                                  />
                                </span>
                              )}
                            </span>
                          </span>
                          {editable && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                        </span>
                        {overlaps.length > 0 && (
                          <span className="flex items-start gap-2 text-xs text-warning-foreground">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span className="flex-1">
                              {overlaps.map((o) => `Se solapa ${formatDuration(o.overlapMinutes)} con ${o.title}`).join(". ")}
                            </span>
                            {editable && <span className="font-semibold underline underline-offset-2">Ajustar</span>}
                          </span>
                        )}
                      </>
                    );
                    const cardClass =
                      "flex min-w-0 flex-1 flex-col gap-2 rounded-[14px] border px-2.5 py-2 " +
                      (overlaps.length > 0 ? "border-warning-border bg-warning-soft" : "bg-card");

                    const travel = travelTo.get(a.id);
                    return (
                      <Fragment key={a.id}>
                        {travel && (
                          <TravelGap
                            tripId={trip.id}
                            toActivityId={a.id}
                            toTitle={a.title}
                            from={travel.from.point!}
                            to={travel.to.point!}
                            gapMinutes={travel.gapMinutes}
                            departAt={travel.from.end.toISOString()}
                            mode={isTravelMode(a.travel_mode) ? a.travel_mode : null}
                            editable={editable}
                          />
                        )}
                        <li className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={
                              "relative size-3 shrink-0 rounded-full border-2 border-card " +
                              (overlaps.length > 0 ? "bg-warning" : "bg-primary")
                            }
                          />
                          <time
                            dateTime={a.starts_at}
                            className="w-11 shrink-0 font-mono text-xs font-semibold"
                          >
                            {instantToZonedTime(a.startsAt, a.timezone).time}
                          </time>
                          {editable ? (
                            <Link href={href} className={cardClass + " hover:border-primary/40"}>
                              {card}
                            </Link>
                          ) : (
                            <div className={cardClass}>{card}</div>
                          )}
                        </li>
                      </Fragment>
                    );
                  })}
                </ol>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
