"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertInflationAction(period: string, inflationYoy: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("inflation_data")
    .upsert(
      { period, inflation_yoy: inflationYoy, source: "manual", fetched_at: new Date().toISOString() },
      { onConflict: "period" }
    );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/investasi");
}
