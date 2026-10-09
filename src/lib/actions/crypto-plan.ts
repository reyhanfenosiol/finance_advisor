"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CryptoAllocation } from "@/types";

export type CryptoPlanInput = {
  monthly_dca_amount: number;
  start_date: string;
  horizon_years: number;
  max_portfolio_pct: number;
  rebalance_threshold_pct: number;
  return_pessimistic: number;
  return_moderate: number;
  return_optimistic: number;
  allocations: CryptoAllocation[];
};

export async function upsertCryptoPlanAction(input: CryptoPlanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const totalPct = input.allocations.reduce((s, a) => s + a.target_pct, 0);
  if (input.allocations.length > 0 && Math.abs(totalPct - 100) > 0.01) {
    throw new Error(`Total alokasi target harus 100% (sekarang ${totalPct}%)`);
  }

  const { error } = await supabase
    .from("crypto_plans")
    .upsert(
      { ...input, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/investasi/crypto-plan");
}
