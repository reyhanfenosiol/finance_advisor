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

// Kandidat rekomendasi: hanya koin berkapitalisasi besar yang tersedia di exchange terdaftar
// Bappebti/OJK. Stablecoin dan altcoin kecil sengaja tidak dimasukkan.
export const RECOMMENDATION_CANDIDATES = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

export type CryptoMarket = {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  priceIdr: number;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  // Harga per jam 7 hari terakhir (USD dari CoinGecko) — dipakai untuk bentuk tren & volatilitas,
  // jadi cukup dibaca sebagai perubahan relatif, bukan nominal.
  sparkline7d: number[];
  lastUpdated: string;
};

// Data pasar + sparkline 7 hari untuk beberapa koin dalam satu request. Cache 30 menit agar
// tidak kena rate limit API publik. Mengembalikan [] bila gagal.
export async function fetchCryptoMarkets(ids: string[]): Promise<CryptoMarket[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=idr&ids=${encodeURIComponent(
      unique.join(",")
    )}&price_change_percentage=24h,7d,30d&sparkline=true`;
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      market_cap_rank: number | null;
      current_price: number | null;
      last_updated: string;
      price_change_percentage_24h_in_currency?: number | null;
      price_change_percentage_7d_in_currency?: number | null;
      price_change_percentage_30d_in_currency?: number | null;
      sparkline_in_7d?: { price?: number[] };
    }>;
    return json
      .filter((c) => typeof c.current_price === "number" && (c.sparkline_in_7d?.price?.length ?? 0) > 24)
      .map((c) => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        rank: c.market_cap_rank,
        priceIdr: c.current_price as number,
        change24h: c.price_change_percentage_24h_in_currency ?? null,
        change7d: c.price_change_percentage_7d_in_currency ?? null,
        change30d: c.price_change_percentage_30d_in_currency ?? null,
        sparkline7d: (c.sparkline_in_7d?.price ?? []).filter((p) => p > 0),
        lastUpdated: c.last_updated,
      }));
  } catch {
    return [];
  }
}
