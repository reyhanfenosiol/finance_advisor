import { createClient } from "@/lib/supabase/server";
import { DashboardInvestasiClient } from "@/components/dashboard/dashboard-investasi-client";

export default async function DashboardInvestasiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: investments }, { data: transactions }, { data: valuations }, { data: inflation }] =
    await Promise.all([
      supabase.from("investments").select("*"),
      supabase.from("investment_transactions").select("*"),
      supabase.from("investment_valuations").select("*").order("valuation_date"),
      supabase.from("inflation_data").select("*").order("period", { ascending: false }).limit(12),
    ]);

  return (
    <DashboardInvestasiClient
      investments={investments ?? []}
      transactions={transactions ?? []}
      valuations={valuations ?? []}
      inflationData={inflation ?? []}
      userId={user.id}
    />
  );
}
