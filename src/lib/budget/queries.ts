import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/** 1 unit of each foreign currency in the trip's currency, as the trip decided. */
export const getExchangeRates = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return new Map<string, number>();
  const supabase = await createClient();
  const { data } = await supabase.from("trip_exchange_rates").select("currency, rate").eq("trip_id", tripId);
  return new Map((data ?? []).map((r) => [r.currency, Number(r.rate)]));
});

export const getExpenses = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, category, description, amount, currency, spent_on, paid_by, notes, split_mode, expense_shares (traveler_id, share)")
    .eq("trip_id", tripId)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) console.error("getExpenses failed", error);
  return data ?? [];
});

export type Expense = Awaited<ReturnType<typeof getExpenses>>[number];

/** Payments between travelers to settle up, newest first. */
export const getSettlements = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlements")
    .select("id, from_traveler, to_traveler, amount, currency, paid_on")
    .eq("trip_id", tripId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) console.error("getSettlements failed", error);
  return data ?? [];
});
