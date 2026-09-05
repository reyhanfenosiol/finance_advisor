import { createClient } from "@/lib/supabase/server";
import { DashboardCashflowClient } from "@/components/dashboard/dashboard-cashflow-client";

export default async function DashboardCashflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: true });

  return <DashboardCashflowClient transactions={transactions ?? []} userId={user.id} />;
}
