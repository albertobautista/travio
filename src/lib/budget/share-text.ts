import { formatMoney, toCents } from "./money";
import type { PersonBalance, Settlement, Transfer } from "./split";

/**
 * "Compartir cuentas": the group's balances as plain text, to paste in a
 * WhatsApp group at the end of the trip. *Bold* is WhatsApp's markup.
 * Pure, so it's easy to test.
 */
export function settleUpText({
  tripName,
  currency,
  spent,
  names,
  balances,
  transfers,
  settlements,
  alsoIn,
}: {
  tripName: string;
  currency: string;
  /** Total spent, in cents of the trip currency. */
  spent: number;
  names: Map<string, string>;
  balances: PersonBalance[];
  transfers: Transfer[];
  settlements: Settlement[];
  /** The amount in "Tu moneda" ("≈ $1,200 MXN"), or null. */
  alsoIn: (cents: number) => string | null;
}) {
  const money = (cents: number) => {
    const home = alsoIn(cents);
    return `${formatMoney(cents, currency)} ${currency}${home ? ` (${home})` : ""}`;
  };
  const name = (id: string) => names.get(id) ?? "Alguien";

  const lines = [`*Cuentas · ${tripName}*`, `Gastado en total: ${money(spent)}`, "", "*Cada quien*"];
  for (const b of balances) {
    const result = b.balance > 0 ? `le deben ${money(b.balance)}` : b.balance < 0 ? `debe ${money(-b.balance)}` : "está a mano";
    lines.push(`• ${name(b.travelerId)}: pagó ${formatMoney(b.paid, currency)}, le toca ${formatMoney(b.owed, currency)}. ${result[0].toUpperCase()}${result.slice(1)}.`);
  }

  lines.push("", "*Para quedar a mano*");
  if (transfers.length === 0) lines.push("Ya están a mano. 🎉");
  for (const t of transfers) lines.push(`• ${name(t.from)} le paga a ${name(t.to)} ${money(t.amount)}`);

  if (settlements.length > 0) {
    lines.push("", "*Pagos ya hechos*");
    for (const s of settlements) {
      lines.push(`• ${name(s.from_traveler)} le pagó a ${name(s.to_traveler)} ${formatMoney(toCents(Number(s.amount)), s.currency)} ${s.currency}`);
    }
  }

  lines.push("", "Hecho con Travio");
  return lines.join("\n");
}
