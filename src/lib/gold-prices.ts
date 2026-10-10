import "server-only";

// Sumber data emas. Semuanya API/halaman publik tanpa key yang bisa berubah atau gagal,
// jadi setiap fungsi mengembalikan nilai kosong saat gagal dan halaman wajib punya fallback
// (riwayat tersimpan di gold_prices / input manual).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const GRAMS_PER_TROY_OUNCE = 31.1034768;

export type GoldPriceRow = { weight: number; sell: number; buyback: number | null };
export type LocalGoldPrices = {
  antam: GoldPriceRow[];
  galeri24: GoldPriceRow[];
  updatedText: string | null;
};

function parseRupiah(s: string) {
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Galeri24 (milik Pegadaian) menampilkan harga jual & buyback Galeri24 dan Antam per ukuran.
// Halamannya server-rendered, jadi cukup dibaca sebagai teks.
export async function fetchGaleri24Prices(): Promise<LocalGoldPrices | null> {
  try {
    const res = await fetch("https://galeri24.co.id/harga-emas", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, "|")
      .replace(/\s+/g, " ")
      .replace(/(\| ?)+/g, "|");

    function section(vendor: string): GoldPriceRow[] {
      const marker = `|Harga ${vendor} |Berat |Harga Jual |Harga Buyback |`;
      const start = text.indexOf(marker);
      if (start < 0) return [];
      const body = text.slice(start + marker.length);
      const end = body.indexOf("Diperbarui");
      const cells = (end >= 0 ? body.slice(0, end) : body).split("|").map((c) => c.trim()).filter(Boolean);
      const rows: GoldPriceRow[] = [];
      for (let i = 0; i + 2 < cells.length; i += 3) {
        const weight = Number(cells[i].replace(",", "."));
        if (!Number.isFinite(weight) || !cells[i + 1].startsWith("Rp")) break;
        const buyback = parseRupiah(cells[i + 2]);
        rows.push({ weight, sell: parseRupiah(cells[i + 1]), buyback: buyback > 0 ? buyback : null });
      }
      return rows;
    }

    const updated = text.match(/Diperbarui ([^|]+)/);
    const result = {
      antam: section("ANTAM"),
      galeri24: section("GALERI 24"),
      updatedText: updated ? updated[1].trim() : null,
    };
    return result.antam.length || result.galeri24.length ? result : null;
  } catch {
    return null;
  }
}

export type SpotPoint = { date: string; usdPerOz: number; usdIdr: number; idrPerGram: number };

async function yahooDailyCloses(symbol: string, range: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
    {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return new Map();
  const json = (await res.json()) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const map = new Map<string, number>();
  ts.forEach((t, i) => {
    const c = closes[i];
    if (typeof c === "number" && c > 0) map.set(new Date(t * 1000).toISOString().slice(0, 10), c);
  });
  return map;
}

// Harga emas dunia (COMEX GC=F, USD/troy ounce) × kurs USD/IDR → Rupiah per gram, harian.
// Harga Antam/Galeri24/emas digital mengikuti angka ini plus premi, jadi tren & proyeksi
// dihitung dari sini karena riwayatnya panjang dan konsisten.
export async function fetchGoldSpotHistoryIdr(range = "2y"): Promise<SpotPoint[]> {
  try {
    const [gold, fx] = await Promise.all([yahooDailyCloses("GC=F", range), yahooDailyCloses("IDR=X", range)]);
    if (gold.size === 0 || fx.size === 0) return [];
    const fxDates = [...fx.keys()].sort();
    const points: SpotPoint[] = [];
    let fxIdx = 0;
    let lastFx: number | null = null;
    for (const date of [...gold.keys()].sort()) {
      // Kurs terakhir yang tersedia pada/sebelum tanggal tersebut (pasar FX & COMEX libur berbeda).
      while (fxIdx < fxDates.length && fxDates[fxIdx] <= date) {
        lastFx = fx.get(fxDates[fxIdx]) ?? lastFx;
        fxIdx++;
      }
      if (lastFx == null) continue;
      const usdPerOz = gold.get(date)!;
      points.push({ date, usdPerOz, usdIdr: lastFx, idrPerGram: (usdPerOz * lastFx) / GRAMS_PER_TROY_OUNCE });
    }
    return points;
  } catch {
    return [];
  }
}
