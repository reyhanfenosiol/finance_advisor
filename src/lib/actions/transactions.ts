"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types";

export type TransactionInput = {
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
};

export async function createTransactionAction(input: TransactionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("transactions")
    .insert({ ...input, user_id: user.id });

  if (error) throw new Error(error.message);
  revalidatePath("/transaksi");
  revalidatePath("/dashboard/cashflow");
}

export async function updateTransactionAction(id: string, input: TransactionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("transactions")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/transaksi");
  revalidatePath("/dashboard/cashflow");
}

export async function deleteTransactionAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/transaksi");
  revalidatePath("/dashboard/cashflow");
}
