"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, toCents } from "@/lib/budget/money";
import { parseAmount } from "@/lib/form-fields";

type Result = { error?: string; ok?: boolean } | undefined;

/**
 * One suggested payment in "Para quedar a mano". "Marcar pagado" records the
 * whole amount; "Otro monto" records part of it (someone paid some now and the
 * rest later), and the balances and suggestions recompute from it.
 *
 * `settle` is a Server Action with the trip and travelers bound; it takes
 * cents of the trip currency.
 */
export function TransferRow({
  children,
  amount,
  currency,
  from,
  to,
  settle,
}: {
  /** The "Ana → Luis $1,200" summary. */
  children: ReactNode;
  /** The suggested amount, in cents. */
  amount: number;
  currency: string;
  /** First names, for labels. */
  from: string;
  to: string;
  settle: (cents: number) => Promise<Result>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [value, setValue] = useState("");
  const inputId = useId();
  const full = formatMoney(amount, currency);

  const record = (cents: number) =>
    start(async () => {
      const r = await settle(cents);
      setError(r?.error ?? null);
      if (!r?.error) {
        setPartial(false);
        setValue("");
      }
    });

  const submitPartial = () => {
    const n = parseAmount(value);
    const cents = Number.isNaN(n) ? NaN : toCents(n);
    if (!Number.isFinite(cents) || cents <= 0) return setError("Escribe cuánto pagó.");
    if (cents > amount) return setError(`Es más de lo que debe (${full}).`);
    record(cents);
  };

  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-1.5 text-sm">{children}</span>
        {!partial && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              disabled={pending}
              aria-label={`Registrar un pago parcial de ${from} a ${to}`}
              onClick={() => {
                setError(null);
                setPartial(true);
              }}
            >
              Otro monto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={pending}
              aria-label={`Marcar que ${from} le pagó ${full} a ${to}`}
              onClick={() => record(amount)}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Marcar pagado
            </Button>
          </span>
        )}
      </div>

      {partial && (
        <form
          className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            submitPartial();
          }}
        >
          <label htmlFor={inputId} className="text-xs text-muted-foreground">
            ¿Cuánto le pagó {from} a {to}? Debe {full}.
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={inputId}
              inputMode="decimal"
              autoFocus
              placeholder={(amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-11 min-w-0 flex-1 font-mono"
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              disabled={pending}
              onClick={() => {
                setPartial(false);
                setValue("");
                setError(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="h-9" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Registrar pago
            </Button>
          </div>
        </form>
      )}

      {error && (
        <span id={`${inputId}-error`} role="alert" className="text-right text-xs text-destructive">
          {error}
        </span>
      )}
    </li>
  );
}
