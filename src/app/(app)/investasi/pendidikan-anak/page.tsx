import { createClient } from "@/lib/supabase/server";
import { EducationClient } from "@/components/investasi/education-client";
import type { EducationPlan } from "@/types";

export default async function EducationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: plan, error: planError }, { data: investments }, { data: transactions }, { data: valuations }] =
    await Promise.all([
      supabase.from("education_plans").select("*").maybeSingle(),
      supabase.from("investments").select("*").order("instrument_name"),
      supabase.from("investment_transactions").select("investment_id, type, amount"),
      supabase
        .from("investment_valuations")
        .select("investment_id, valuation_date, current_value")
        .order("valuation_date", { ascending: false }),
    ]);

  // Nilai tiap instrumen: valuasi terakhir, atau modal bersih bila belum pernah divaluasi.
  const values: Record<string, number> = {};
  for (const inv of investments ?? []) {
    const latest = valuations?.find((v) => v.investment_id === inv.id);
    if (latest) {
      values[inv.id] = Number(latest.current_value);
      continue;
    }
    values[inv.id] = (transactions ?? [])
      .filter((t) => t.investment_id === inv.id)
      .reduce((s, t) => s + (t.type === "buy" ? Number(t.amount) : -Number(t.amount)), 0);
  }

  return (
    <EducationClient
      plan={(plan as EducationPlan | null) ?? null}
      tableReady={!planError}
      investments={investments ?? []}
      investmentValues={values}
    />
  );
}
