import "server-only";

// Harga spot dalam IDR dari CoinGecko (API publik, tanpa key). Bisa gagal/terkena
// rate limit — pemanggil wajib punya fallback (harga manual / valuasi terakhir).
export async function fetchCryptoPricesIdr(ids: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      unique.join(",")
    )}&vs_currencies=idr`;
    const res = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as Record<string, { idr?: number }>;
    const prices: Record<string, number> = {};
    for (const [id, v] of Object.entries(json)) {
      if (typeof v?.idr === "number") prices[id] = v.idr;
    }
    return prices;
  } catch {
    return {};
  }
}
