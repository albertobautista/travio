import Link from "next/link";
import { BedDouble, ExternalLink, MapPin, Paperclip, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { countNights } from "@/lib/accommodations/stays";
import { formatDuration } from "@/lib/activities/schedule";
import { formatMoney, toCents } from "@/lib/budget/money";
import { perNight, priceInTripCurrency } from "@/lib/options/compare";
import { formatLegTimes, legMinutes, legTimes } from "@/lib/transportations/legs";
import { transportMeta } from "@/lib/transportations/types";
import { formatTripDates } from "@/lib/trips/dates";
import { instantToZonedTime, formatLocalMoment } from "@/lib/zoned-time";

type Money = { tripCurrency: string; rates: Map<string, number> };
type Priced = { id: string; cost_amount: number | null; cost_currency: string | null };

/** Total as entered, plus the trip-currency figure when it's a different currency. */
function Price({ item, money, nights }: { item: Priced; money: Money; nights?: number }) {
  if (item.cost_amount === null || !item.cost_currency) {
    return <p className="text-sm text-muted-foreground">Sin precio</p>;
  }
  const cents = toCents(Number(item.cost_amount));
  const inTrip = item.cost_currency === money.tripCurrency ? null : priceInTripCurrency(item, money.tripCurrency, money.rates);
  const night = nights !== undefined ? perNight(cents, nights) : null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <strong className="text-lg">{formatMoney(cents, item.cost_currency)}</strong>
      <span className="text-xs text-muted-foreground">
        {item.cost_currency}
        {inTrip !== null && ` · ≈ ${formatMoney(inTrip, money.tripCurrency)} ${money.tripCurrency}`}
        {night !== null && nights! > 1 && ` · ${formatMoney(night, item.cost_currency)} por noche`}
      </span>
    </p>
  );
}

function Highlights({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <li key={label} className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-foreground">
          {label}
        </li>
      ))}
    </ul>
  );
}

function Actions({ url, href, editable }: { url: string | null; href: string; editable: boolean }) {
  if (!url && !editable) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {url && (
        <Button asChild variant="outline" className="h-11 flex-1">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Abrir enlace
          </a>
        </Button>
      )}
      {editable && (
        <Button asChild variant="outline" className="h-11 flex-1">
          <Link href={href}>
            <Pencil aria-hidden="true" />
            Elegir o editar
          </Link>
        </Button>
      )}
    </div>
  );
}

type StayOption = Priced & {
  name: string;
  address: string | null;
  check_in_at: string;
  check_out_at: string;
  timezone: string;
  booking_url: string | null;
  notes: string | null;
};

/** A stay being compared: dates, nights, price (and per night), why it's interesting. */
export function StayOptionCard({
  tripId,
  option,
  money,
  highlights,
  fileCount,
  editable,
}: {
  tripId: string;
  option: StayOption;
  money: Money;
  highlights: string[];
  fileCount: number;
  editable: boolean;
}) {
  const nights = countNights(option);
  const checkIn = instantToZonedTime(option.check_in_at, option.timezone).date;
  const checkOut = instantToZonedTime(option.check_out_at, option.timezone).date;
  const titleId = `option-${option.id}`;

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-2 rounded-2xl border border-dashed bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <BedDouble className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 id={titleId} className="leading-tight font-semibold">
            {option.name}
          </h4>
          <p className="text-sm text-muted-foreground">
            {formatTripDates(checkIn, checkOut, { year: false })} · {nights === 1 ? "1 noche" : `${nights} noches`}
          </p>
          {option.address && (
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{option.address}</span>
            </p>
          )}
        </div>
      </div>
      <Highlights labels={highlights} />
      <Price item={option} money={money} nights={nights} />
      {option.notes && <p className="line-clamp-3 text-sm whitespace-pre-line text-foreground/80">{option.notes}</p>}
      {fileCount > 0 && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" aria-hidden="true" />
          {fileCount === 1 ? "1 archivo" : `${fileCount} archivos`}
        </p>
      )}
      <Actions url={option.booking_url} href={`/viajes/${tripId}/hospedajes/${option.id}`} editable={editable} />
    </article>
  );
}

type LegOption = Priced & {
  type: string;
  carrier: string | null;
  service_number: string | null;
  departs_at: string;
  departs_timezone: string;
  arrives_at: string;
  arrives_timezone: string;
  booking_url: string | null;
  notes: string | null;
};

/** A leg being compared: who runs it, when, how long it takes and what it costs. */
export function LegOptionCard({
  tripId,
  option,
  money,
  highlights,
  fileCount,
  editable,
}: {
  tripId: string;
  option: LegOption;
  money: Money;
  highlights: string[];
  fileCount: number;
  editable: boolean;
}) {
  const meta = transportMeta(option.type);
  const Icon = meta.icon;
  const service = [option.carrier, option.service_number].filter(Boolean).join(" · ");
  const day = formatLocalMoment(option.departs_at, option.departs_timezone).split(" · ")[0];
  const { dayShift } = legTimes(option);
  const titleId = `option-${option.id}`;

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-2 rounded-2xl border border-dashed bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 id={titleId} className="leading-tight font-semibold">
            {service || meta.label}
          </h4>
          <p className="text-sm text-muted-foreground">
            {day} · <span className="font-mono">{formatLegTimes(option)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {service ? `${meta.label} · ` : ""}
            {formatDuration(legMinutes(option))}
            {dayShift > 0 ? " · llega otro día" : ""}
          </p>
        </div>
      </div>
      <Highlights labels={highlights} />
      <Price item={option} money={money} />
      {option.notes && <p className="line-clamp-3 text-sm whitespace-pre-line text-foreground/80">{option.notes}</p>}
      {fileCount > 0 && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" aria-hidden="true" />
          {fileCount === 1 ? "1 archivo" : `${fileCount} archivos`}
        </p>
      )}
      <Actions url={option.booking_url} href={`/viajes/${tripId}/transporte/${option.id}`} editable={editable} />
    </article>
  );
}
