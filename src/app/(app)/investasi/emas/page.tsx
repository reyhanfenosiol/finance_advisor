import { createClient } from "@/lib/supabase/server";
import { fetchGaleri24Prices, fetchGoldSpotHistoryIdr } from "@/lib/gold-prices";
import { GoldClient } from "@/components/investasi/gold-client";
import type { GoldPrice } from "@/types";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export default async function GoldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [local, spot] = await Promise.all([fetchGaleri24Prices(), fetchGoldSpotHistoryIdr("2y")]);

  // Catat harga 1 gram Antam & Galeri24 hari ini sekali per hari, supaya riwayat harga lokal
  // terbentuk dengan sendirinya. Input manual di hari yang sama tidak ditimpa.
  const oneGram = (rows: { weight: number; sell: number; buyback: number | null }[] | undefined) =>
    rows?.find((r) => r.weight === 1);
  const autoRows = (
    [
      ["antam", oneGram(local?.antam)],
      ["galeri24", oneGram(local?.galeri24)],
    ] as const
  )
    .filter(([, r]) => r)
    .map(([brand, r]) => ({
      user_id: user.id,
      brand,
      price_date: todayJakarta(),
      sell_price: r!.sell,
      buyback_price: r!.buyback,
      source: "otomatis" as const,
    }));
  let tableReady = true;
  if (autoRows.length > 0) {
    const { error } = await supabase
      .from("gold_prices")
      .upsert(autoRows, { onConflict: "user_id,brand,price_date", ignoreDuplicates: true });
    if (error) tableReady = false;
  }

  const since = new Date();
  since.setDate(since.getDate() - 365);
  const { data: history, error: historyError } = await supabase
    .from("gold_prices")
    .select("*")
    .gte("price_date", since.toISOString().slice(0, 10))
    .order("price_date");
  if (historyError) tableReady = false;

  return (
    <GoldClient
      local={local}
      spot={spot.map((p) => ({ date: p.date, idrPerGram: p.idrPerGram }))}
      history={(history ?? []) as GoldPrice[]}
      tableReady={tableReady}
    />
  );
}
