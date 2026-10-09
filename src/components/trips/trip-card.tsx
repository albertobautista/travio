import Link from "next/link";
import { Hourglass, Plane, Sun } from "lucide-react";

import type { CountdownTarget } from "@/lib/trips/countdown";
import { formatTripDates, getTripLengthDays, type TripStatus } from "@/lib/trips/dates";

import { TripCountdown } from "./trip-countdown";
import { TripStatusBadge } from "./trip-status-badge";

export type TripCardData = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  /** Signed URL, or null to show the placeholder. */
  coverUrl: string | null;
  /** City names in route order. */
  cities: string[];
  travelerCount: number;
  /** 0–100, or null for undated trips (see lib/trips/progress). */
  progress: number | null;
  /** Upcoming trips: "Faltan 35 días". */
  daysLeft?: string | null;
};

const MAX_CITY_CHIPS = 3;

export function TripCard({ trip }: { trip: TripCardData }) {
  const days = getTripLengthDays(trip.start_date, trip.end_date);

  return (
    <Link
      href={`/viajes/${trip.id}`}
      className="pressable flex gap-3 rounded-[18px] border bg-card p-2.5 shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {trip.coverUrl ? (
        // Plain <img>: signed URLs change on every load, so the Next image optimizer adds nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trip.coverUrl} alt="" className="h-28 w-23 shrink-0 rounded-xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-28 w-23 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"
        >
          <Plane className="size-7" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-base font-bold">{trip.name}</span>
          <TripStatusBadge status={trip.status} />
        </span>
        <span className="text-sm text-foreground/80">{formatTripDates(trip.start_date, trip.end_date)}</span>
        <span className="text-xs text-muted-foreground">
          {[
            trip.travelerCount === 1 ? "1 viajero" : `${trip.travelerCount} viajeros`,
            days ? (days === 1 ? "1 día" : `${days} días`) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {trip.daysLeft && (
          <span className="flex w-fit items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            <Hourglass className="size-3" aria-hidden="true" />
            {trip.daysLeft}
          </span>
        )}
        {trip.cities.length > 0 && (
          <span className="flex gap-1 overflow-hidden">
            {trip.cities.slice(0, MAX_CITY_CHIPS).map((city, i) => (
              <span key={i} className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                {city}
              </span>
            ))}
            {trip.cities.length > MAX_CITY_CHIPS && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                +{trip.cities.length - MAX_CITY_CHIPS}
              </span>
            )}
          </span>
        )}
        {trip.progress !== null && trip.status !== "past" && (
          <span className="mt-auto flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span
                className={"bar-fill block h-full rounded-full " + (trip.progress >= 60 ? "bg-success" : "bg-primary")}
                style={{ width: `${trip.progress}%` }}
              />
            </span>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{trip.progress}% planificado</span>
          </span>
        )}
      </span>
    </Link>
  );
}

export type ActiveTripData = TripCardData & {
  dayNumber: number;
  days: number;
  /** City the travelers are in today, if the stops say so. */
  city: string | null;
};

/**
 * The trip in progress, on top of Mis viajes: big cover, where it's at, and a
 * straight way into Hoy.
 */
export function ActiveTripCard({ trip }: { trip: ActiveTripData }) {
  const share = trip.days > 1 ? (trip.dayNumber - 1) / (trip.days - 1) : 1;
  return (
    <article className="overflow-hidden rounded-[20px] border bg-card shadow-[0_1px_2px_rgba(11,27,51,.06),0_12px_28px_-16px_rgba(11,27,51,.25)]">
      <Link href={`/viajes/${trip.id}`} className="relative block h-44 bg-secondary">
        {trip.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-full items-center justify-center text-primary">
            <Plane className="size-10" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-10 pb-3 text-white">
          <span className="text-[22px] leading-tight font-bold">{trip.name}</span>
          <span className="text-sm text-white/90">
            Día {trip.dayNumber} de {trip.days}
            {trip.city ? ` · hoy en ${trip.city}` : ""}
          </span>
        </span>
      </Link>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTripDates(trip.start_date, null)}</span>
            <span>{formatTripDates(trip.end_date, null)}</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Día ${trip.dayNumber} de ${trip.days}`}
            aria-valuemin={1}
            aria-valuemax={trip.days}
            aria-valuenow={trip.dayNumber}
            className="relative h-1.5 rounded-full bg-border"
          >
            <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
            <span
              aria-hidden="true"
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 animate-pop rounded-full border-[3px] border-primary bg-card"
              style={{ left: `${share * 100}%` }}
            />
          </div>
        </div>
        {trip.cities.length > 0 && (
          <span className="flex gap-1.5 overflow-hidden">
            {trip.cities.slice(0, 4).map((city, i) => (
              <span
                key={i}
                className={
                  "shrink-0 rounded-md px-2 py-0.5 text-xs " +
                  (city === trip.city ? "bg-secondary font-semibold text-secondary-foreground" : "bg-muted text-foreground/80")
                }
              >
                {city}
              </span>
            ))}
            {trip.cities.length > 4 && <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80">+{trip.cities.length - 4}</span>}
          </span>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/viajes/${trip.id}/hoy`}
            className="pressable flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            <Sun className="size-4" aria-hidden="true" />
            Abrir Hoy
          </Link>
          <Link href={`/viajes/${trip.id}`} className="pressable flex h-11 items-center justify-center rounded-xl border bg-card text-sm font-semibold hover:bg-muted">
            Ver viaje
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * The next trip, on top of the upcoming ones: its cover and a live countdown
 * to the first departure (or the first day).
 */
export function NextTripCard({ trip, target, serverNow }: { trip: TripCardData; target: CountdownTarget; serverNow: number }) {
  return (
    <Link
      href={`/viajes/${trip.id}`}
      className="pressable block overflow-hidden rounded-[20px] border bg-card shadow-[0_1px_2px_rgba(11,27,51,.06),0_12px_28px_-16px_rgba(11,27,51,.25)] transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="relative block h-36 bg-secondary">
        {trip.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-full items-center justify-center text-primary">
            <Plane className="size-10" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-10 pb-3 text-white">
          <span className="text-xl leading-tight font-bold">{trip.name}</span>
          <span className="text-sm text-white/90">
            {[formatTripDates(trip.start_date, trip.end_date), trip.travelerCount === 1 ? "1 viajero" : `${trip.travelerCount} viajeros`].join(" · ")}
          </span>
        </span>
      </span>
      <span className="block p-4">
        <TripCountdown target={target} serverNow={serverNow} />
      </span>
    </Link>
  );
}
