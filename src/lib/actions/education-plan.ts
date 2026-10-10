"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type EducationPlanInput } from "@/lib/education-plan";

export async function upsertEducationPlanAction(input: EducationPlanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (input.children.length < 1 || input.children.length > 2) {
    throw new Error("Isi data 1 atau 2 anak");
  }
  for (const c of input.children) {
    if (!c.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(c.birth_date)) {
      throw new Error("Nama dan tanggal lahir (atau rencana lahir) anak wajib diisi");
    }
  }
  for (const s of STAGES) {
    const c = input.costs[s.key];
    if (!c || [c.entry_fee, c.monthly_fee, c.yearly_other].some((v) => !(v >= 0))) {
      throw new Error(`Biaya ${s.label} tidak valid`);
    }
  }

  const { error } = await supabase.from("education_plans").upsert(
    {
      ...input,
      children: input.children.map((c) => ({ name: c.name.trim(), birth_date: c.birth_date })),
      user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/investasi/pendidikan-anak");
}
