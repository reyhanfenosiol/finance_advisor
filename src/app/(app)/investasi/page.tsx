import { createClient } from "@/lib/supabase/server";
import { InvestasiClient } from "@/components/investasi/investasi-client";

export default async function InvestasiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: investments }, { data: transactions }, { data: valuations }] = await Promise.all([
    supabase.from("investments").select("*").order("instrument_name"),
    supabase
      .from("investment_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("investment_valuations")
      .select("*")
      .order("valuation_date", { ascending: false }),
  ]);

  return (
    <InvestasiClient
      initialInstruments={investments ?? []}
      initialTransactions={transactions ?? []}
      initialValuations={valuations ?? []}
      userId={user.id}
    />
  );
}
