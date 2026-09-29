"use server";

import { refresh } from "next/cache";

import { isBudgetCategory } from "@/lib/budget/categories";
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

  return {
    data: { description, amount, currency, category, spent_on: spentOn, paid_by: paidBy || null, notes: notes || null },
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
