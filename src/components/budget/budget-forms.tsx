"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { selectClass } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUDGET_CATEGORIES, BUDGET_META } from "@/lib/budget/categories";
import { formatMoney, toCents } from "@/lib/budget/money";
import { allocate, SPLIT_MODES, type SplitMode } from "@/lib/budget/split";
import { parseAmount } from "@/lib/form-fields";
import { CURRENCIES } from "@/lib/trips/currencies";

type Action<S> = (prev: S, formData: FormData) => Promise<S>;
type State = { error?: string; ok?: boolean } | undefined;

function FormError({ state }: { state: State }) {
  return state?.error ? (
    <p role="alert" className="text-sm text-destructive">
      {state.error}
    </p>
  ) : null;
}

/** Total budget for the trip, in its currency. */
export function BudgetAmountForm({ action, currency, initial }: { action: Action<State>; currency: string; initial: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="budget_amount">Presupuesto total ({currency})</Label>
      <div className="flex gap-2">
        <Input id="budget_amount" name="budget_amount" inputMode="decimal" placeholder="95000" defaultValue={initial} className="h-11" />
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <FormError state={state} />
    </form>
  );
}

/** "1 EUR = [21.30] MXN", with the ECB's rate one tap away. */
export function RateForm({
  action,
  currency,
  tripCurrency,
  current,
  suggestion,
}: {
  action: Action<State>;
  currency: string;
  tripCurrency: string;
  current: number | null;
  suggestion: { rate: number; date: string } | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const input = useRef<HTMLInputElement>(null);
  const suggested = suggestion ? String(Number(suggestion.rate.toFixed(4))) : null;
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <label htmlFor={`rate-${currency}`} className="shrink-0 font-mono text-sm font-semibold">
          1 {currency} =
        </label>
        <Input
          ref={input}
          id={`rate-${currency}`}
          name="rate"
          inputMode="decimal"
          placeholder={suggested ?? "0.00"}
          defaultValue={current === null ? "" : String(current)}
          className="h-11 font-mono"
        />
        <span className="shrink-0 font-mono text-sm">{tripCurrency}</span>
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending} aria-label={`Guardar tipo de cambio de ${currency}`}>
          <Check aria-hidden="true" />
        </Button>
      </div>
      {suggestion && (
        <button
          type="button"
          onClick={() => {
            if (input.current) input.current.value = suggested!;
            input.current?.form?.requestSubmit();
          }}
          className="self-start text-xs text-primary hover:underline"
        >
          Usar {suggested} (BCE, {suggestion.date})
        </button>
      )}
      <FormError state={state} />
    </form>
  );
}

type Traveler = { id: string; name: string };

export type ExpenseValues = {
  description: string;
  amount: string;
  currency: string;
  category: string;
  spent_on: string;
  paid_by: string;
  notes: string;
  split_mode: SplitMode;
  /** Travelers taking part (all of them when the expense has no shares). */
  split_ids: string[];
  /** Amount or percentage per traveler, as typed. */
  shares: Record<string, string>;
};

/** Add or edit an expense. Resets itself after adding one. */
export function ExpenseForm({
  action,
  onDelete,
  initial,
  travelers,
  submitLabel,
}: {
  action: Action<State>;
  onDelete?: () => Promise<State>;
  initial: ExpenseValues;
  travelers: Traveler[];
  submitLabel: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  // Amount and currency are tracked to show each person's part as you type.
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [mode, setMode] = useState<SplitMode>(initial.split_mode);
  const [selected, setSelected] = useState<string[]>(initial.split_ids);
  const [shares, setShares] = useState<Record<string, string>>(initial.shares);

  const [state, formAction, pending] = useActionState(async (prev: State, formData: FormData) => {
    const result = await action(prev, formData);
    // After adding, clear it for the next one (keep date, currency, payer and who's in).
    if (result?.ok && !onDelete && form.current) {
      (form.current.elements.namedItem("description") as HTMLInputElement).value = "";
      (form.current.elements.namedItem("notes") as HTMLInputElement).value = "";
      setAmount("");
      setShares({});
    }
    return result;
  }, undefined);

  return (
    <form ref={form} action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">¿En qué?</Label>
        <Input id="description" name="description" maxLength={160} placeholder="Tapas en El Xampanyet" defaultValue={initial.description} className="h-11" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="42.50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Moneda</Label>
          <select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Categoría</Label>
          <select id="category" name="category" defaultValue={initial.category} className={selectClass}>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BUDGET_META[c].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spent_on">Fecha</Label>
          <Input id="spent_on" name="spent_on" type="date" defaultValue={initial.spent_on} className="h-11" />
        </div>
      </div>
      {travelers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paid_by">¿Quién pagó?</Label>
          <select id="paid_by" name="paid_by" defaultValue={initial.paid_by} className={selectClass}>
            <option value="">Sin especificar</option>
            {travelers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {travelers.length > 1 && (
        <SplitFields
          travelers={travelers}
          amount={amount}
          currency={currency}
          mode={mode}
          onMode={setMode}
          selected={selected}
          onSelected={setSelected}
          shares={shares}
          onShares={setShares}
        />
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Input id="notes" name="notes" maxLength={1000} defaultValue={initial.notes} className="h-11" />
      </div>
      <FormError state={state} />
      {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
      <div className="flex items-center gap-2">
        {onDelete &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <span className="text-sm">¿Borrar?</span>
              <Button
                type="button"
                size="sm"
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  const r = await onDelete();
                  setDeleting(false);
                  if (r?.error) setDeleteError(r.error);
                }}
              >
                {deleting ? "Borrando…" : "Sí, borrar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                No
              </Button>
            </span>
          ) : (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              Borrar
            </Button>
          ))}
        <Button type="submit" className="ml-auto h-11" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
      {state?.ok && !onDelete && (
        <p role="status" className="text-sm text-success-foreground">
          Gasto guardado.
        </p>
      )}
    </form>
  );
}

/**
 * "¿Entre quiénes?": who takes part and how the expense is divided. The
 * inputs are plain form fields (split_mode, split_ids, share_{id}); the
 * server checks them again. Unticked people's inputs are disabled, so they
 * aren't sent.
 */
function SplitFields({
  travelers,
  amount,
  currency,
  mode,
  onMode,
  selected,
  onSelected,
  shares,
  onShares,
}: {
  travelers: Traveler[];
  amount: string;
  currency: string;
  mode: SplitMode;
  onMode: (mode: SplitMode) => void;
  selected: string[];
  onSelected: (ids: string[]) => void;
  shares: Record<string, string>;
  onShares: (shares: Record<string, string>) => void;
}) {
  const total = parseAmount(amount);
  const totalCents = Number.isNaN(total) ? null : toCents(total);
  const money = (cents: number) => formatMoney(cents, currency);
  const inSplit = travelers.filter((t) => selected.includes(t.id));
  const equalParts = totalCents === null ? [] : allocate(totalCents, inSplit.map(() => 1));
  const partOf = new Map(inSplit.map((t, i) => [t.id, equalParts[i]]));

  // What's typed so far, against what it should add up to.
  const typed = inSplit.reduce((sum, t) => {
    const n = parseAmount(shares[t.id] ?? "");
    return sum + (Number.isNaN(n) ? 0 : toCents(n));
  }, 0);
  const target = mode === "amount" ? totalCents : 100 * 100;
  const diff = target === null ? null : target - typed;
  const unit = (cents: number) => (mode === "amount" ? money(cents) : `${cents / 100}%`);

  const toggle = (id: string, on: boolean) =>
    onSelected(on ? travelers.filter((t) => t.id === id || selected.includes(t.id)).map((t) => t.id) : selected.filter((x) => x !== id));

  // Fill the empty boxes with what's left, in equal parts.
  function fillRest() {
    if (diff === null || diff <= 0) return;
    const empty = inSplit.filter((t) => !(shares[t.id] ?? "").trim());
    if (empty.length === 0) return;
    const parts = allocate(diff, empty.map(() => 1));
    onShares({ ...shares, ...Object.fromEntries(empty.map((t, i) => [t.id, (parts[i] / 100).toFixed(2)])) });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border p-3">
      <legend className="px-1 text-sm font-medium">¿Entre quiénes?</legend>
      <input type="hidden" name="split_mode" value={mode} />
      <div role="radiogroup" aria-label="Cómo se reparte" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(Object.keys(SPLIT_MODES) as SplitMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onMode(m)}
            className={
              "min-h-9 rounded-md px-1 text-xs font-medium " +
              (mode === m ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")
            }
          >
            {m === "equal" ? "Iguales" : m === "amount" ? "Montos" : "Porcentajes"}
          </button>
        ))}
      </div>
      <ul className="flex flex-col">
        {travelers.map((t) => {
          const on = selected.includes(t.id);
          return (
            <li key={t.id} className="flex min-h-11 items-center gap-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="split_ids"
                  value={t.id}
                  checked={on}
                  onChange={(e) => toggle(t.id, e.target.checked)}
                  className="size-5 accent-primary"
                />
                <span className={"truncate " + (on ? "" : "text-muted-foreground")}>{t.name}</span>
              </label>
              {mode === "equal" ? (
                <span className="font-mono text-sm text-muted-foreground">{on && partOf.get(t.id) !== undefined ? money(partOf.get(t.id)!) : "—"}</span>
              ) : (
                <span className="flex items-center gap-1">
                  <Input
                    name={`share_${t.id}`}
                    inputMode="decimal"
                    aria-label={`${mode === "amount" ? "Monto" : "Porcentaje"} de ${t.name}`}
                    placeholder={mode === "amount" ? "0.00" : "0"}
                    disabled={!on}
                    value={on ? (shares[t.id] ?? "") : ""}
                    onChange={(e) => onShares({ ...shares, [t.id]: e.target.value })}
                    className="h-10 w-24 text-right font-mono"
                  />
                  <span className="w-8 text-xs text-muted-foreground">{mode === "amount" ? currency : "%"}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {inSplit.length === 0 ? (
          <span className="text-destructive">Elige al menos a una persona.</span>
        ) : mode === "equal" ? (
          totalCents === null ? (
            `Entre ${inSplit.length}, en partes iguales.`
          ) : (
            `${money(totalCents)} entre ${inSplit.length}.`
          )
        ) : diff === null ? (
          "Escribe primero el monto del gasto."
        ) : diff === 0 ? (
          <span className="text-success-foreground">Suma {mode === "amount" ? money(target!) : "100%"}. ✓</span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="text-warning-foreground">{diff > 0 ? `Faltan ${unit(diff)}` : `Sobran ${unit(-diff)}`}</span>
            {diff > 0 && inSplit.some((t) => !(shares[t.id] ?? "").trim()) && (
              <button type="button" onClick={fillRest} className="font-medium text-primary hover:underline">
                Repartir lo que falta
              </button>
            )}
          </span>
        )}
      </p>
    </fieldset>
  );
}
