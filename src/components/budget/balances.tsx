import { ArrowRight, Scale } from "lucide-react";

import { SettleButton } from "@/components/budget/settle-button";
import { TravelerAvatar } from "@/components/travelers/traveler-avatar";
import { formatDayLabel } from "@/lib/activities/itinerary";
import { formatMoney, toCents } from "@/lib/budget/money";
import type { PersonBalance, Settlement, Transfer } from "@/lib/budget/split";
import type { Traveler } from "@/lib/travelers/queries";

import { addSettlement, deleteSettlement } from "@/app/viajes/[id]/presupuesto/actions";

/**
 * "Cuentas del grupo": what each traveler paid and their part, the payments
 * that settle everyone, and the payments already made.
 */
export function Balances({
  tripId,
  currency,
  travelers,
  balances,
  transfers,
  settlements,
  withoutPayer,
  unconverted,
  editable,
}: {
  tripId: string;
  currency: string;
  travelers: Traveler[];
  balances: PersonBalance[];
  transfers: Transfer[];
  settlements: (Settlement & { paid_on: string })[];
  withoutPayer: number;
  unconverted: string[];
  editable: boolean;
}) {
  const money = (cents: number) => formatMoney(cents, currency);
  const byId = new Map(travelers.map((t) => [t.id, t]));
  const first = (id: string) => byId.get(id)?.name.split(" ")[0] ?? "Alguien";

  return (
    <section aria-labelledby="balances" className="flex flex-col gap-3">
      <h2 id="balances" className="font-semibold">
        Cuentas del grupo
      </h2>

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {balances.map((b) => {
          const t = byId.get(b.travelerId);
          if (!t) return null;
          return (
            <li key={b.travelerId} className="flex items-center gap-3 px-3 py-2.5">
              <TravelerAvatar traveler={t} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  pagó <span className="font-mono">{money(b.paid)}</span> · le toca <span className="font-mono">{money(b.owed)}</span>
                  {b.settled !== 0 && (
                    <>
                      {" "}
                      · {b.settled > 0 ? "dio" : "recibió"} <span className="font-mono">{money(Math.abs(b.settled))}</span>
                    </>
                  )}
                </span>
              </span>
              <span
                className={
                  "shrink-0 font-mono text-sm font-semibold " +
                  (b.balance > 0 ? "text-success-foreground" : b.balance < 0 ? "text-destructive" : "text-muted-foreground")
                }
              >
                {b.balance > 0 ? "+" : b.balance < 0 ? "−" : ""}
                {money(Math.abs(b.balance))}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        + le deben · − debe. En {currency}, con los tipos de cambio del viaje.
        {withoutPayer > 0 && ` ${withoutPayer === 1 ? "1 gasto no tiene" : `${withoutPayer} gastos no tienen`} quién pagó y no cuenta${withoutPayer === 1 ? "" : "n"}.`}
        {unconverted.length > 0 && ` Sin tipo de cambio, fuera de las cuentas: ${unconverted.join(", ")}.`}
      </p>

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
        <h3 className="text-sm font-semibold">Para quedar a mano</h3>
        {transfers.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Scale className="size-4 text-success" aria-hidden="true" />
            Están a mano.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((t) => (
              <li key={`${t.from}-${t.to}`} className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm">
                  <span className="font-medium">{first(t.from)}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-label="le paga a" />
                  <span className="font-medium">{first(t.to)}</span>
                  <span className="font-mono font-semibold">{money(t.amount)}</span>
                </span>
                {editable && (
                  <SettleButton
                    kind="settle"
                    label={`Marcar que ${first(t.from)} le pagó ${money(t.amount)} a ${first(t.to)}`}
                    action={addSettlement.bind(null, tripId, t.from, t.to, t.amount)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {settlements.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-medium text-muted-foreground">Pagos registrados</h3>
          <ul className="flex flex-col gap-1.5">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">
                    {first(s.from_traveler)} le pagó a {first(s.to_traveler)}{" "}
                    <span className="font-mono font-semibold">{formatMoney(toCents(Number(s.amount)), s.currency)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground first-letter:uppercase">{formatDayLabel(s.paid_on)}</span>
                </span>
                {editable && (
                  <SettleButton kind="undo" label="Deshacer este pago" action={deleteSettlement.bind(null, tripId, s.id)} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
