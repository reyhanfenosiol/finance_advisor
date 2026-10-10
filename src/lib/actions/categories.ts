"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/types";

const DEFAULT_CATEGORIES: { name: string; type: TransactionType }[] = [
  { name: "Gaji", type: "income" },
  { name: "Bonus", type: "income" },
  { name: "Usaha Sampingan", type: "income" },
  { name: "Lainnya", type: "income" },
  { name: "Makan", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Hiburan", type: "expense" },
  { name: "Tagihan", type: "expense" },
  { name: "Belanja", type: "expense" },
  { name: "Kesehatan", type: "expense" },
  { name: "Lainnya", type: "expense" },
];

export async function ensureDefaultCategories(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return;

  await supabase
    .from("categories")
    .upsert(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: userId })),
      { onConflict: "user_id,name,type", ignoreDuplicates: true }
    );
}

export async function createCategoryAction(name: string, type: TransactionType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: existing } = await supabase
    .from("categories")
    .select()
    .eq("user_id", user.id)
    .eq("type", type)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("categories")
    .insert({ name, type, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/transaksi");
  return data;
}
