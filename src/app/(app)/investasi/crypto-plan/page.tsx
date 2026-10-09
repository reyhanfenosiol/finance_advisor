import { createClient } from "@/lib/supabase/server";
import { fetchCryptoPricesIdr } from "@/lib/crypto-prices";
import { CryptoPlanClient } from "@/components/investasi/crypto-plan-client";
import type { CryptoPlan } from "@/types";

export default async function CryptoPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [
    { data: plan },
    { data: investments },
    { data: transactions },
    { data: valuations },
    { data: inflation },
  ] = await Promise.all([
    supabase.from("crypto_plans").select("*").maybeSingle(),
    supabase.from("investments").select("*"),
    supabase.from("investment_transactions").select("*").order("transaction_date"),
    supabase.from("investment_valuations").select("*").order("valuation_date"),
    supabase.from("inflation_data").select("*").order("period", { ascending: false }).limit(1),
  ]);

  const typedPlan = plan as CryptoPlan | null;
  const coingeckoIds = (typedPlan?.allocations ?? [
    { coingecko_id: "bitcoin" },
    { coingecko_id: "ethereum" },
  ]).map((a) => a.coingecko_id);
  const livePrices = await fetchCryptoPricesIdr(coingeckoIds);

  return (
    <CryptoPlanClient
      plan={typedPlan}
      investments={investments ?? []}
      transactions={transactions ?? []}
      valuations={valuations ?? []}
      latestInflation={inflation?.[0] ?? null}
      livePrices={livePrices}
    />
  );
}
