import Link from "next/link";
import { Plane } from "lucide-react";

import { formatTripDates, getTripLengthDays, type TripStatus } from "@/lib/trips/dates";

import { TripStatusBadge } from "./trip-status-badge";

export type TripCardData = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  /** Signed URL, or null to show the placeholder. */
  coverUrl: string | null;
};

export function TripCard({ trip }: { trip: TripCardData }) {
  const days = getTripLengthDays(trip.start_date, trip.end_date);

  return (
    <Link
      href={`/viajes/${trip.id}`}
      className="flex gap-3 rounded-[18px] border bg-card p-2.5 shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
        {days && <span className="text-xs text-muted-foreground">{days === 1 ? "1 día" : `${days} días`}</span>}
      </span>
    </Link>
  );
}
