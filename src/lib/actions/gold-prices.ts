"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoldBrand } from "@/types";

export type GoldPriceInput = {
  brand: GoldBrand;
  price_date: string;
  sell_price: number;
  buyback_price: number | null;
  platform: string | null;
};

export async function upsertGoldPriceAction(input: GoldPriceInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (!(input.sell_price > 0)) throw new Error("Harga beli per gram harus lebih dari 0");
  if (input.buyback_price != null && input.buyback_price > input.sell_price) {
    throw new Error("Harga buyback tidak boleh lebih tinggi dari harga beli");
  }

  const { error } = await supabase.from("gold_prices").upsert(
    {
      ...input,
      platform: input.platform?.trim() || null,
      source: "manual",
      user_id: user.id,
    },
    { onConflict: "user_id,brand,price_date" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/investasi/emas");
}

export async function deleteGoldPriceAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gold_prices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/investasi/emas");
}
