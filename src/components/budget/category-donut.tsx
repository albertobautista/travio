"use client";

import { useState } from "react";

import { BUDGET_META, type BudgetCategory } from "@/lib/budget/categories";
import { formatMoney } from "@/lib/budget/money";

type Mode = "spent" | "estimated";
type Row = { category: BudgetCategory; estimated: number; spent: number };

const R = 48;
const C = 2 * Math.PI * R;
// Gap between slices, in the same units as the circle's length.
const GAP = 2;

/**
 * "Por categoría" like Alberto's design: a donut with one color per category
 * and a legend with amount and share. Switches between what was spent and
 * what's planned (estimated); starts on spent once there's any.
 */
export function CategoryDonut({ rows, currency }: { rows: Row[]; currency: string }) {
  const hasSpent = rows.some((r) => r.spent > 0);
  const [mode, setMode] = useState<Mode>(hasSpent ? "spent" : "estimated");
  const money = (cents: number) => formatMoney(cents, currency);

  const total = rows.reduce((a, r) => a + r[mode], 0);
  const shown = rows.filter((r) => r[mode] > 0).sort((a, b) => b[mode] - a[mode]);
  const pct = (cents: number) => (total ? Math.round((cents / total) * 100) : 0);
  const gap = shown.length > 1 ? GAP : 0;

  // Each slice starts where the ones before it end.
  const lengths = shown.map((r) => (r[mode] / total) * C);
  const slices = shown.map((r, i) => ({
    category: r.category,
    dash: Math.max(lengths[i] - gap, 0.5),
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Qué mostrar" className="grid grid-cols-2 gap-1 self-start rounded-lg bg-muted p-1">
        {(["spent", "estimated"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={
              "min-h-9 rounded-md px-3 text-xs font-medium " +
              (mode === m ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")
            }
          >
            {m === "spent" ? "Gastado" : "Estimado"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-5">
        <svg
          viewBox="0 0 120 120"
          className="size-32 shrink-0 -rotate-90"
          role="img"
          aria-label={
            total === 0
              ? "Sin montos todavía"
              : shown.map((s) => `${BUDGET_META[s.category].label} ${pct(s[mode])}%`).join(", ")
          }
        >
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="16" className="stroke-muted" />
          {slices.map((s) => (
            <circle
              key={s.category}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="16"
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={-s.offset}
              className={BUDGET_META[s.category].stroke}
            />
          ))}
        </svg>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{mode === "spent" ? "Total gastado" : "Total estimado"}</p>
          <p className="font-mono text-2xl font-bold">{money(total)}</p>
          {total === 0 && (
            <p className="text-xs text-muted-foreground">
              {mode === "spent" ? "Aún no hay gastos." : "Aún no hay costos en hospedajes, trayectos o actividades."}
            </p>
          )}
        </div>
      </div>

      {shown.length > 0 && (
        <ul className="flex flex-col">
          {shown.map((r) => {
            const meta = BUDGET_META[r.category];
            return (
              <li key={r.category} className="flex min-h-9 items-center gap-2.5 text-sm">
                <span className={"size-2.5 shrink-0 rounded-full " + meta.dot} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                {mode === "spent" && r.estimated > 0 && (
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">de {money(r.estimated)}</span>
                )}
                <span className="font-mono font-medium">{money(r[mode])}</span>
                <span className="w-10 text-right font-mono text-xs text-muted-foreground">{pct(r[mode])}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
