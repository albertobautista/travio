import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BedDouble, CalendarDays, Check, ExternalLink, FolderLock, Map as MapIcon, Navigation, Paperclip, Plus, Ticket } from "lucide-react";

import { StayCard } from "@/components/accommodations/stay-card";
import { TransportCard } from "@/components/transportations/transport-card";
import { StartsIn } from "@/components/activities/starts-in";
import { RainNotice, WeatherNow } from "@/components/weather/today-weather";
import { PlacePhoto } from "@/components/maps/place-photo";
import { LeaveBy } from "@/components/activities/leave-by";
import { GapIdeas } from "@/components/ideas/gap-ideas";
import { aiConfigured } from "@/lib/ai/gap-ideas";
import { TravelGap } from "@/components/activities/travel-gap";
import { FileRow, ticketHref } from "@/components/files/file-row";
import { TripClock } from "@/components/trips/trip-clock";
import { TravelerStack } from "@/components/travelers/traveler-avatar";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, isCategory } from "@/lib/activities/categories";
import { buildDayPlan, forTraveler, formatStartsIn } from "@/lib/activities/day-plan";
import { activityDate } from "@/lib/activities/itinerary";
import { getAccommodations } from "@/lib/accommodations/queries";
import { stayForToday, stayPhase } from "@/lib/accommodations/stays";
import { getActivities } from "@/lib/activities/queries";
import { legsForToday, legTimes } from "@/lib/transportations/legs";
import { getTransportations } from "@/lib/transportations/queries";
import { getTripFiles } from "@/lib/files/queries";
import { formatDuration, formatTimeRange } from "@/lib/activities/schedule";
import { createClient } from "@/lib/supabase/server";
import { getTravelers } from "@/lib/travelers/queries";
import { formatTripDates, getTripDayNumber, getTripLengthDays, getTripStatus } from "@/lib/trips/dates";
import { clockParts, zoneCity } from "@/lib/trips/clock";
import { canEdit, getMyTripRole, getStops, getTrip } from "@/lib/trips/queries";
import { resolveTripNow } from "@/lib/trips/today";
import { directionsUrl } from "@/lib/maps/directions";
import { hotelStarts, isTravelMode, travelPairs } from "@/lib/maps/travel";
import { getDailyWeather, getNowWeather } from "@/lib/weather/open-meteo";
import { instantToZonedTime } from "@/lib/zoned-time";

import { rememberActivityPlace } from "../actividades/actions";

export async function generateMetadata({ params }: PageProps<"/viajes/[id]/hoy">): Promise<Metadata> {
  const trip = await getTrip((await params).id);
  return { title: trip ? `Hoy · ${trip.name} · Travio` : "Hoy · Travio" };
}

const longDate = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function formatLongDate(date: string) {
  const s = longDate.format(new Date(`${date}T00:00:00Z`)).replace(/\./g, "").replace(/ de /g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function TodayPage({ params, searchParams }: PageProps<"/viajes/[id]/hoy">) {
  const { id } = await params;
  const { todos } = await searchParams;
  const supabase = await createClient();
  const [trip, role, stops, activities, travelers, files, stays, legs, { data: claims }] = await Promise.all([
    getTrip(id),
    getMyTripRole(id),
    getStops(id),
    getActivities(id),
    getTravelers(id),
    getTripFiles(id),
    getAccommodations(id),
    getTransportations(id),
    supabase.auth.getClaims(),
  ]);
  if (!trip) notFound();

  const now = new Date();
  const editable = canEdit(role);
  // The owner's switch for the trip, and a key on the server.
  const aiOn = trip.ai_enabled && aiConfigured();
  const { today, timeZone, stop } = resolveTripNow(stops, now);
  const status = getTripStatus(trip.start_date, trip.end_date, today);
  const dayNumber = getTripDayNumber(trip.start_date, trip.end_date, today);
  const tripDays = getTripLengthDays(trip.start_date, trip.end_date);
  const travelerById = new Map(travelers.map((t) => [t.id, t]));
  // Tickets and reservations attached to each activity, oldest first (the order they were added).
  const filesByActivity = new Map<string, typeof files>();
  for (const f of [...files].reverse()) {
    if (f.activity_id) filesByActivity.set(f.activity_id, [...(filesByActivity.get(f.activity_id) ?? []), f]);
  }

  // "Mi día": if the viewer is one of the travelers, show only what they take part in.
  const me = travelers.find((t) => t.user_id === claims?.claims.sub);
  const showAll = todos === "1" || !me;
  const mine = (list: typeof prepared) => (showAll ? list : forTraveler(list, me!.id));

  const prepared = activities.map((a) => ({
    ...a,
    date: activityDate(a),
    startsAt: new Date(a.starts_at),
    durationMinutes: a.duration_minutes,
    participantIds: a.activity_participants.map((p) => p.traveler_id),
  }));
  const todays = mine(prepared.filter((a) => a.date === today));
  const tomorrowFirst = mine(prepared.filter((a) => a.date === addDays(today, 1)))[0];
  const hasSubsets = prepared.some((a) => a.participantIds.length > 0);

  // Where they sleep: the stay they're in, or the one checked into/out of today.
  const myStays = stays.filter((s) => {
    const ids = s.accommodation_participants.map((p) => p.traveler_id);
    return showAll || ids.length === 0 || ids.includes(me!.id);
  });
  const stay = stayForToday(myStays, now, today);
  const stayEyebrow = (() => {
    if (!stay) return undefined;
    const phase = stayPhase(stay, now);
    const checkIn = instantToZonedTime(stay.check_in_at, stay.timezone);
    const checkOut = instantToZonedTime(stay.check_out_at, stay.timezone);
    if (phase === "before") return `Llegas hoy · check-in desde las ${checkIn.time}`;
    if (phase === "after") return `Saliste hoy a las ${checkOut.time}`;
    return checkOut.date === today ? `Sales hoy · check-out a las ${checkOut.time}` : "Esta noche duermes en";
  })();

  // Flights, trains… departing today or under way, for the people shown.
  const todaysLegs = legsForToday(
    legs.filter((l) => {
      const ids = l.transportation_participants.map((p) => p.traveler_id);
      return showAll || ids.length === 0 || ids.includes(me!.id);
    }),
    now,
    today,
  );

  // Weather where the travelers are (the stop for today), if it has coordinates.
  const weatherPlace = stop && stop.lat !== null && stop.lng !== null ? { lat: stop.lat, lng: stop.lng, timezone: stop.timezone } : null;
  const [nowWeather, todayWeather] = weatherPlace
    ? await Promise.all([getNowWeather(weatherPlace, today), getDailyWeather(weatherPlace, today, today, today)])
    : [null, null];

  const plan = buildDayPlan(todays, now);
  // Travel time between consecutive plans (free-time rows don't break the chain).
  const pairStop = (a: (typeof prepared)[number]) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    start: a.startsAt,
    end: new Date(a.startsAt.getTime() + a.duration_minutes * 60_000),
    point: a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : null,
    participantIds: a.participantIds,
  });
  const travelTo = new Map(
    travelPairs(plan.items.flatMap((i) => (i.kind === "activity" ? [pairStop(i.activity)] : []))).map((pair) => [pair.to.id, pair]),
  );
  // And from the hotel: where you woke up, or where you check in today (a trip today in between breaks it).
  const asHotel = (s: (typeof myStays)[number]) => ({
    name: s.name,
    point: s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null,
  });
  const morningStay = myStays.find(
    (s) => instantToZonedTime(s.check_in_at, s.timezone).date < today && today <= instantToZonedTime(s.check_out_at, s.timezone).date,
  );
  const fromHotel = hotelStarts<ReturnType<typeof pairStop>, ReturnType<typeof asHotel>>(
    [
      ...todays.map((a) => ({ at: a.startsAt.getTime(), row: { kind: "activity" as const, stop: pairStop(a) } })),
      ...todaysLegs.map((l) => ({ at: Date.parse(l.departs_at), row: { kind: "leg" as const } })),
      ...myStays
        .filter((s) => instantToZonedTime(s.check_in_at, s.timezone).date === today)
        .map((s) => ({ at: Date.parse(s.check_in_at), row: { kind: "check_in" as const, stay: asHotel(s) } })),
    ]
      .sort((a, b) => a.at - b.at)
      .map((r) => r.row),
    morningStay ? asHotel(morningStay) : null,
  );
  // Where you set off for an activity: the previous plan, or the hotel.
  const originOf = (a: (typeof prepared)[number]) => {
    const pair = travelTo.get(a.id);
    if (pair) return { point: pair.from.point!, label: pair.from.title, departAt: pair.from.end.toISOString(), gap: pair.gapMinutes };
    const hotel = fromHotel.get(a.id);
    if (hotel) return { point: hotel.point!, label: hotel.name, departAt: new Date(a.startsAt.getTime() - 45 * 60_000).toISOString(), gap: null };
    return null;
  };
  const peopleOf = (a: (typeof prepared)[number]) =>
    a.participantIds.length > 0 ? a.participantIds.flatMap((pid) => travelerById.get(pid) ?? []) : travelers;
  const base = `/viajes/${trip.id}`;
  // A leg that leaves before the next plan (or is under way) goes above it.
  const firstPlanStart = plan.focus[0]?.startsAt.getTime() ?? Infinity;
  const legsFirst = todaysLegs.filter((l) => Date.parse(l.departs_at) <= firstPlanStart);
  const legsAfter = todaysLegs.filter((l) => Date.parse(l.departs_at) > firstPlanStart);
  const legCard = (leg: (typeof todaysLegs)[number]) => {
    const underway = Date.parse(leg.departs_at) <= now.getTime();
    const { arrives } = legTimes(leg);
    return (
      <TransportCard
        key={leg.id}
        tripId={trip.id}
        leg={leg}
        travelers={travelers}
        files={files.filter((f) => f.transportation_id === leg.id)}
        editable={false}
        eyebrow={
          underway ? (
            `En camino · llegas a las ${arrives.time}`
          ) : (
            <>
              Sale <StartsIn startsAt={leg.departs_at} initial={formatStartsIn(new Date(leg.departs_at), now)} />
            </>
          )
        }
      />
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">Hoy{stop ? ` · ${stop.name}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(today)}
            {dayNumber && tripDays ? ` · día ${dayNumber} de ${tripDays}` : ""}
          </p>
          <TripClock timeZone={timeZone} place={stop?.name ?? zoneCity(timeZone)} initial={clockParts(now, timeZone)} />
        </div>
        {nowWeather && stop && <WeatherNow city={stop.name} now={nowWeather} today={todayWeather?.get(today) ?? null} />}
      </header>

      {me && hasSubsets && (
        <nav aria-label="Qué mostrar" className="flex gap-2">
          {[
            { label: "Mi día", href: `${base}/hoy`, active: !showAll },
            { label: "Todo el grupo", href: `${base}/hoy?todos=1`, active: showAll },
          ].map((o) => (
            <Link
              key={o.label}
              href={o.href}
              aria-current={o.active ? "page" : undefined}
              className={
                "flex h-9 items-center rounded-full px-3 text-sm " +
                (o.active ? "bg-primary font-semibold text-primary-foreground" : "border bg-card text-foreground/80 hover:bg-muted")
              }
            >
              {o.label}
            </Link>
          ))}
        </nav>
      )}

      {legsFirst.map(legCard)}

      {nowWeather && (
        <RainNotice
          now={nowWeather}
          plans={todays.map((a) => ({ title: a.title, time: instantToZonedTime(a.startsAt, a.timezone).time }))}
        />
      )}

      {todays.length === 0 ? (
        // A travel day with only a flight isn't "nothing planned": the leg card says it all.
        todaysLegs.length > 0 ? null : (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-8 text-center">
            <CalendarDays className="size-8 text-primary" aria-hidden="true" />
            <p className="font-semibold">
              {status === "upcoming" && trip.start_date
                ? `Tu viaje empieza el ${formatTripDates(trip.start_date, null)}`
                : status === "past"
                  ? "Este viaje ya terminó"
                  : status === "undated"
                    ? "Este viaje aún no tiene fechas"
                    : "Hoy no hay nada planeado"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {status === "active"
                ? "Día libre. Si surge un plan, agrégalo para tenerlo a la mano."
                : "Aquí verás el plan de cada día mientras viajas: qué sigue, cómo llegar y tus reservas."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {editable && status === "active" && (
                <Button asChild>
                  <Link href={`${base}/actividades/nueva?dia=${today}`}>
                    <Plus aria-hidden="true" />
                    Agregar actividad
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={`${base}/itinerario`}>Ver itinerario</Link>
              </Button>
            </div>
          </section>
        )
      ) : plan.focus.length > 0 ? (
        plan.focus.map((focus) => {
          const category = isCategory(focus.category) ? CATEGORY_META[focus.category] : CATEGORY_META.other;
          const Icon = category.icon;
          const happening = plan.current.includes(focus);
          const people = peopleOf(focus);
          const directions = directionsUrl({ ...focus, name: focus.location_name });
          const overlaps = plan.items.find((i) => i.kind === "activity" && i.activity.id === focus.id);
          const titleId = `focus-${focus.id}`;
          const tickets = filesByActivity.get(focus.id) ?? [];
          const origin = happening || focus.lat === null || focus.lng === null ? null : originOf(focus);
          return (
            <section key={focus.id} aria-labelledby={titleId} className="flex flex-col overflow-hidden rounded-[20px] border bg-card">
              <PlacePhoto
                name={focus.location_name ?? focus.title}
                query={focus.location_name ? [focus.location_name, focus.address].filter(Boolean).join(", ") : ""}
                placeId={focus.google_place_id}
                lat={focus.lat}
                lng={focus.lng}
                radius={5_000}
                remember={editable ? rememberActivityPlace.bind(null, trip.id, focus.id) : undefined}
                maxWidth={800}
                maxHeight={400}
                creditAt="top"
                className="h-[196px]"
                fallback={
                  <div className={`flex size-full items-start justify-center pt-12 ${category.className}`} aria-hidden="true">
                    <Icon className="size-12" />
                  </div>
                }
              >
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-4 pt-10 pb-3 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white/85">
                      {happening ? "Ahora" : showAll ? "Próximo plan" : "Tu próximo plan"}
                    </span>
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                      {happening ? "En curso" : <StartsIn startsAt={focus.starts_at} initial={formatStartsIn(focus.startsAt, now)} />}
                    </span>
                  </div>
                  <h2 id={titleId} className="text-xl leading-tight font-bold">
                    {focus.title}
                  </h2>
                  <p className="truncate text-sm text-white/85">
                    {formatTimeRange(focus.startsAt, focus.duration_minutes, focus.timezone)} ({formatDuration(focus.duration_minutes)})
                    {focus.location_name || focus.address ? ` · ${focus.location_name ?? focus.address}` : ""}
                  </p>
                </div>
              </PlacePhoto>
              <div className="flex flex-col gap-3 p-4">
                {people.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TravelerStack travelers={people} max={4} />
                    <span className="truncate">
                      {focus.participantIds.length === 0 ? "Todo el grupo" : people.map((t) => t.name.split(" ")[0]).join(", ")}
                    </span>
                  </div>
                )}
                {origin && (
                  <LeaveBy
                    from={origin.point}
                    to={{ lat: focus.lat!, lng: focus.lng! }}
                    mode={isTravelMode(focus.travel_mode) ? focus.travel_mode : null}
                    fromLabel={origin.label}
                    departAt={origin.departAt}
                    arriveAt={focus.starts_at}
                    timeZone={focus.timezone}
                    now={now.toISOString()}
                  />
                )}
                {overlaps?.kind === "activity" && overlaps.conflicts.length > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-2 text-xs text-warning-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {overlaps.conflicts.map((c) => `Se solapa ${formatDuration(c.overlapMinutes)} con ${c.title}`).join(". ")}
                  </p>
                )}
                {focus.reservation_ref && (
                  <p className="text-sm">
                    Referencia: <strong className="font-mono">{focus.reservation_ref}</strong>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {directions ? (
                    <Button asChild size="lg" className="h-11">
                      <a href={directions} target="_blank" rel="noopener noreferrer">
                        <Navigation aria-hidden="true" />
                        Ir ahora
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" className="h-11" disabled title="Agrega el lugar o la dirección a la actividad">
                      <Navigation aria-hidden="true" />
                      Ir ahora
                    </Button>
                  )}
                  {tickets.length > 0 ? (
                    <Button asChild size="lg" variant="outline" className="h-11">
                      <Link href={ticketHref(trip.id, tickets[0].id)}>
                        <Ticket aria-hidden="true" />
                        Mi ticket
                      </Link>
                    </Button>
                  ) : focus.external_url ? (
                    <Button asChild size="lg" variant="outline" className="h-11">
                      <a href={focus.external_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" />
                        Ver reserva
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="lg" variant="outline" className="h-11">
                      <Link href={editable ? `${base}/actividades/${focus.id}` : `${base}/itinerario?dia=${today}`}>
                        {editable ? "Ver detalles" : "Ver en itinerario"}
                      </Link>
                    </Button>
                  )}
                </div>
                {tickets.length > 1 && (
                  <ul aria-label="Boletos y reservas" className="flex flex-col gap-2">
                    {tickets.slice(1).map((file) => (
                      <li key={file.id}>
                        <FileRow tripId={trip.id} file={file} />
                      </li>
                    ))}
                  </ul>
                )}
                {!directions && (
                  <p className="text-xs text-muted-foreground">
                    {editable
                      ? "Agrega el lugar o la dirección a la actividad para ver cómo llegar."
                      : "Esta actividad aún no tiene lugar ni dirección."}
                  </p>
                )}
              </div>
            </section>
          );
        })
      ) : (
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
          <p className="font-semibold">Terminaste los planes de hoy</p>
          <p className="text-sm text-muted-foreground">
            {tomorrowFirst
              ? `Mañana: ${tomorrowFirst.title} a las ${instantToZonedTime(tomorrowFirst.startsAt, tomorrowFirst.timezone).time}.`
              : "Mañana no hay nada planeado todavía."}
          </p>
        </section>
      )}

      {legsAfter.map(legCard)}

      {!stay && editable && status === "active" && (
        <Link
          href={`${base}/hospedajes/nuevo${stop ? `?ciudad=${stop.id}` : ""}`}
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed bg-card p-4 hover:border-primary/40"
        >
          <BedDouble className="size-5 text-primary" aria-hidden="true" />
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">¿Dónde duermes hoy?</span>
            <span className="text-sm text-muted-foreground">Agrega el hospedaje para tener la dirección y la reserva aquí.</span>
          </span>
        </Link>
      )}
      {stay && (
        <StayCard
          tripId={trip.id}
          stay={stay}
          travelers={travelers}
          files={files.filter((f) => f.accommodation_id === stay.id)}
          editable={false}
          eyebrow={stayEyebrow}
        />
      )}

      {todays.length > 0 && (
        <section aria-labelledby="day-heading" className="flex flex-col gap-2">
          <h2 id="day-heading" className="font-semibold">
            El día de hoy
          </h2>
          <ol className="relative flex flex-col">
            <span aria-hidden="true" className="absolute top-5 bottom-5 left-[5px] w-0.5 bg-timeline" />
            {plan.items.map((item, i) => {
              if (item.kind === "free") {
                // Ideas for it (AI on, an hour or more, not over yet).
                const before = plan.items[i - 1];
                const after = plan.items[i + 1];
                if (
                  aiOn &&
                  item.minutes >= 60 &&
                  before?.kind === "activity" &&
                  after?.kind === "activity" &&
                  after.activity.startsAt.getTime() > now.getTime()
                ) {
                  return (
                    <GapIdeas
                      key={`free-${i}`}
                      tripId={trip.id}
                      fromActivityId={before.activity.id}
                      toActivityId={after.activity.id}
                      gapMinutes={item.minutes}
                      editable={editable}
                    />
                  );
                }
                return (
                  <li key={`free-${i}`} className="flex items-center gap-2.5 py-1 pl-6 text-xs text-muted-foreground">
                    Tiempo libre · {formatDuration(item.minutes)}
                  </li>
                );
              }
              const a = item.activity;
              const done = item.state === "done";
              const current = item.state === "now";
              const people = peopleOf(a);
              const attached = filesByActivity.get(a.id)?.length ?? 0;
              const row = (
                <>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={"truncate text-sm " + (done ? "text-muted-foreground line-through" : "font-semibold")}>
                      {a.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDuration(a.duration_minutes)}
                      {current ? " · ahora" : item.isNext ? " · siguiente" : ""}
                      {a.location_name ? ` · ${a.location_name}` : ""}
                    </span>
                    {attached > 0 && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Paperclip className="size-3" aria-hidden="true" />
                        {attached === 1 ? "1 archivo" : `${attached} archivos`}
                      </span>
                    )}
                    {item.conflicts.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-warning-foreground">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        Se solapa con {item.conflicts.map((c) => c.title).join(", ")}
                      </span>
                    )}
                  </span>
                  {people.length > 0 && <TravelerStack travelers={people} max={3} />}
                </>
              );
              const origin = done ? null : originOf(a);
              return (
                <Fragment key={a.id}>
                  {origin && (
                    <TravelGap
                      tripId={trip.id}
                      toActivityId={a.id}
                      toTitle={a.title}
                      from={origin.point}
                      to={{ lat: a.lat!, lng: a.lng! }}
                      gapMinutes={origin.gap}
                      fromLabel={origin.gap === null ? origin.label : undefined}
                      departAt={origin.departAt}
                      arriveAt={a.starts_at}
                      timeZone={a.timezone}
                      mode={isTravelMode(a.travel_mode) ? a.travel_mode : null}
                      editable={editable}
                    />
                  )}
                  <li
                    className={"flex items-center gap-2.5 rounded-xl py-2 " + (current || item.isNext ? "-mx-2 bg-secondary px-2" : "")}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "relative flex size-3 shrink-0 items-center justify-center rounded-full " +
                        (done ? "bg-success" : current ? "bg-primary ring-4 ring-primary/20" : "border-2 border-primary bg-card")
                      }
                    >
                      {done && <Check className="size-2 text-white" strokeWidth={4} />}
                    </span>
                    <time dateTime={a.starts_at} className="w-11 shrink-0 font-mono text-xs font-semibold">
                      {instantToZonedTime(a.startsAt, a.timezone).time}
                    </time>
                    <span className="sr-only">{done ? "Hecho." : current ? "En curso." : ""}</span>
                    {editable ? (
                      <Link href={`${base}/actividades/${a.id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                        {row}
                      </Link>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center gap-2">{row}</span>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg" className="h-12">
              <Link href={`${base}/mapa?dia=${today}`}>
                <MapIcon aria-hidden="true" />
                Ver mapa del día
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 sm:h-12">
              <Link href={`${base}/itinerario?dia=${today}`}>
                <CalendarDays aria-hidden="true" />
                Ver en el itinerario
              </Link>
            </Button>
          </div>
        </section>
      )}

      <Link
        href={`${base}/documentos`}
        className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40"
      >
        <FolderLock className="size-5 text-primary" aria-hidden="true" />
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">Documentos del viaje</span>
          <span className="text-sm text-muted-foreground">
            {files.length === 0 ? "Boletos, reservas y seguros" : `${files.length} ${files.length === 1 ? "archivo" : "archivos"}`}
          </span>
        </span>
      </Link>
    </main>
  );
}
