"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InstrumentType, InvestmentOwnership, InvestmentTransactionType } from "@/types";

export async function createInstrumentAction(
  instrumentName: string,
  instrumentType: InstrumentType,
  ownership: InvestmentOwnership = "pribadi"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("investments")
    .insert({
      instrument_name: instrumentName,
      instrument_type: instrumentType,
      ownership,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
  return data;
}

export async function updateInstrumentOwnershipAction(id: string, ownership: InvestmentOwnership) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investments")
    .update({ ownership })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function updateInstrumentTypeAction(id: string, instrumentType: InstrumentType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investments")
    .update({ instrument_type: instrumentType })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export type InvestmentTransactionInput = {
  investment_id: string;
  type: InvestmentTransactionType;
  amount: number;
  units: number | null;
  price_per_unit: number | null;
  transaction_date: string;
};

export async function createInvestmentTransactionAction(input: InvestmentTransactionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investment_transactions")
    .insert({ ...input, user_id: user.id });

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function updateInvestmentTransactionAction(
  id: string,
  input: InvestmentTransactionInput
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investment_transactions")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function deleteInvestmentTransactionAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investment_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function updateValuationAction(id: string, currentValue: number, valuationDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investment_valuations")
    .update({ current_value: currentValue, valuation_date: valuationDate })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function deleteValuationAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("investment_valuations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}

export async function createValuationAction(
  investmentId: string,
  currentValue: number,
  valuationDate: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("investment_valuations").insert({
    investment_id: investmentId,
    current_value: currentValue,
    valuation_date: valuationDate,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/investasi");
  revalidatePath("/dashboard/investasi");
}
