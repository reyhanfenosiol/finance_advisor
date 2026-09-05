import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "@/lib/actions/categories";
import { TransaksiClient } from "@/components/transaksi/transaksi-client";

export default async function TransaksiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  await ensureDefaultCategories(user.id);

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <TransaksiClient
      initialTransactions={transactions ?? []}
      initialCategories={categories ?? []}
      userId={user.id}
    />
  );
}
