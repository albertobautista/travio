"use server";

import { refresh } from "next/cache";

import { isBudgetCategory } from "@/lib/budget/categories";
import { toCents } from "@/lib/budget/money";
import { isSplitMode } from "@/lib/budget/split";
import { parseAmount, text } from "@/lib/form-fields";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/trips/trip-form";
import { isOfferedCurrency } from "@/lib/trips/currencies";
import { isUuid } from "@/lib/uuid";

// Ids arrive via .bind() and can be tampered with; RLS decides what the user
// may change. Blocked writes return zero rows, so every write asks for them.

export type BudgetActionState = { error?: string; ok?: boolean } | undefined;

const denied = { error: "No tienes permiso para editar este viaje." };

/** The trip's total budget, in its currency. Empty clears it. */
export async function setBudgetAmount(tripId: string, _prev: BudgetActionState, formData: FormData): Promise<BudgetActionState> {
  if (!isUuid(tripId)) return { error: "Este viaje no existe." };
  const raw = text(formData, "budget_amount");
  const amount = raw ? parseAmount(raw) : null;
  if (amount !== null && (Number.isNaN(amount) || amount <= 0)) return { error: "Escribe un monto, por ejemplo 95000." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("trips").update({ budget_amount: amount }).eq("id", tripId).select("id");
  if (error) {
    console.error("setBudgetAmount failed", error);
    return { error: "No pudimos guardar el presupuesto. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;
  refresh();
  return { ok: true };
}

/** "1 EUR = 21.30 MXN" for this trip. Upsert: one row per currency. */
export async function setExchangeRate(
  tripId: string,
  currency: string,
  _prev: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  if (!isUuid(tripId) || !/^[A-Z]{3}$/.test(currency)) return { error: "Moneda no válida." };
  const rate = parseAmountPrecise(text(formData, "rate"));
  if (rate === null) return { error: "Escribe un número mayor que 0, por ejemplo 20.35." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_exchange_rates")
    .upsert({ trip_id: tripId, currency, rate }, { onConflict: "trip_id,currency" })
    .select("currency");
  if (error) {
    console.error("setExchangeRate failed", error);
    return error.code === "42501" ? denied : { error: "No pudimos guardar el tipo de cambio." };
  }
  if (data.length === 0) return denied;
  refresh();
  return { ok: true };
}

/** Rates need more than 2 decimals ("0.0543"), unlike amounts. */
function parseAmountPrecise(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export type ExpenseFormState = { error?: string; ok?: boolean } | undefined;

/**
 * The split from the form: the travelers ticked in `split_ids` and, for
 * amounts or percentages, a `share_{travelerId}` for each. Checked here for
 * clear messages; set_expense_shares checks the sums again in the database.
 */
function parseSplit(formData: FormData, travelerIds: string[], amount: number) {
  const mode = text(formData, "split_mode") || "equal";
  if (!isSplitMode(mode)) return { error: "Elige cómo se reparte." };
  const ids = [...new Set(formData.getAll("split_ids").map(String))];
  // No split fields at all (a trip with one traveler): everyone, equal.
  if (!formData.has("split_mode")) return { mode, shares: [] };
  if (ids.length === 0) return { error: "Elige al menos a una persona para repartir el gasto." };
  if (ids.some((id) => !travelerIds.includes(id))) return { error: "Elige a alguien del viaje." };
  if (mode === "equal") return { mode, shares: ids.map((traveler_id) => ({ traveler_id })) };

  const shares = ids.map((traveler_id) => ({ traveler_id, share: parseAmount(text(formData, `share_${traveler_id}`)) }));
  if (shares.some((s) => Number.isNaN(s.share) || s.share <= 0)) {
    return { error: mode === "amount" ? "Escribe cuánto le toca a cada persona." : "Escribe el porcentaje de cada persona." };
  }
  const sum = shares.reduce((a, s) => a + toCents(s.share), 0);
  const target = mode === "amount" ? toCents(amount) : 100 * 100;
  if (sum !== target) {
    return { error: mode === "amount" ? "Los montos de cada persona deben sumar el total del gasto." : "Los porcentajes deben sumar 100%." };
  }
  return { mode, shares };
}

function parseExpense(formData: FormData, travelerIds: string[]) {
  const description = text(formData, "description");
  const amount = parseAmount(text(formData, "amount"));
  const currency = text(formData, "currency");
  const category = text(formData, "category");
  const spentOn = text(formData, "spent_on");
  const paidBy = text(formData, "paid_by");
  const notes = text(formData, "notes");

  if (!description) return { error: "¿En qué fue? Escribe una descripción." };
  if (description.length > 160) return { error: "La descripción es muy larga (máximo 160)." };
  if (Number.isNaN(amount) || amount <= 0) return { error: "Escribe el monto, por ejemplo 42.50." };
  if (!isOfferedCurrency(currency)) return { error: "Elige una moneda de la lista." };
  if (!isBudgetCategory(category)) return { error: "Elige una categoría de la lista." };
  if (!isIsoDate(spentOn)) return { error: "Elige la fecha." };
  if (paidBy && !travelerIds.includes(paidBy)) return { error: "Elige a alguien del viaje." };
  if (notes.length > 1000) return { error: "Las notas son muy largas (máximo 1000)." };
  const split = parseSplit(formData, travelerIds, amount);
  if ("error" in split) return { error: split.error };

  return {
    data: { description, amount, currency, category, spent_on: spentOn, paid_by: paidBy || null, notes: notes || null },
    split,
  };
}

async function travelerIdsOf(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("travelers").select("id").eq("trip_id", tripId);
  return (data ?? []).map((t) => t.id);
}

export async function saveExpense(
  tripId: string,
  expenseId: string | null,
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  if (!isUuid(tripId) || (expenseId !== null && !isUuid(expenseId))) return { error: "Este gasto no existe." };
  const parsed = parseExpense(formData, await travelerIdsOf(tripId));
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const query = expenseId
    ? supabase.from("expenses").update(parsed.data).eq("trip_id", tripId).eq("id", expenseId)
    : supabase.from("expenses").insert({ ...parsed.data, trip_id: tripId });
  const { data, error } = await query.select("id");
  if (error) {
    console.error("saveExpense failed", error);
    return error.code === "42501" ? denied : { error: "No pudimos guardar el gasto. Inténtalo de nuevo." };
  }
  if (data.length === 0) return denied;

  // Then its split, in one transaction of its own (see set_expense_shares).
  const { error: splitError } = await supabase.rpc("set_expense_shares", {
    p_expense_id: data[0].id,
    p_mode: parsed.split.mode,
    p_shares: parsed.split.shares,
  });
  if (splitError) {
    console.error("set_expense_shares failed", splitError);
    // A new expense without its split would be split among everyone: undo it.
    if (!expenseId) await supabase.from("expenses").delete().eq("trip_id", tripId).eq("id", data[0].id);
    return { error: "No pudimos guardar cómo se reparte. Revisa los montos e inténtalo de nuevo." };
  }
  refresh();
  return { ok: true };
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<ExpenseFormState> {
  if (!isUuid(tripId) || !isUuid(expenseId)) return { error: "Este gasto no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").delete().eq("trip_id", tripId).eq("id", expenseId).select("id");
  if (error) {
    console.error("deleteExpense failed", error);
    return { error: "No pudimos borrar el gasto." };
  }
  if (data.length === 0) return denied;
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Settling up
// ---------------------------------------------------------------------------

/**
 * "Ximena paid Alberto $300": records a suggested payment (from the balances)
 * as done. Cents in the trip's currency; the currency is read from the trip,
 * not taken from the browser.
 */
export async function addSettlement(tripId: string, from: string, to: string, cents: number): Promise<BudgetActionState> {
  if (!isUuid(tripId) || !isUuid(from) || !isUuid(to) || from === to || !Number.isInteger(cents) || cents <= 0) {
    return { error: "Este pago no es válido." };
  }
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("currency").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "Este viaje no existe." };
  const { data, error } = await supabase
    .from("settlements")
    .insert({ trip_id: tripId, from_traveler: from, to_traveler: to, amount: cents / 100, currency: trip.currency })
    .select("id");
  if (error) {
    console.error("addSettlement failed", error);
    return error.code === "42501" ? denied : { error: "No pudimos registrar el pago." };
  }
  if (data.length === 0) return denied;
  refresh();
  return { ok: true };
}

/** Undo a recorded payment. */
export async function deleteSettlement(tripId: string, settlementId: string): Promise<BudgetActionState> {
  if (!isUuid(tripId) || !isUuid(settlementId)) return { error: "Este pago no existe." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("settlements").delete().eq("trip_id", tripId).eq("id", settlementId).select("id");
  if (error) {
    console.error("deleteSettlement failed", error);
    return { error: "No pudimos deshacer el pago." };
  }
  if (data.length === 0) return denied;
  refresh();
  return { ok: true };
}
