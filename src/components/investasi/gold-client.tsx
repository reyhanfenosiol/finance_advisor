"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Clock, ShoppingCart, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { analyzeGold, type BuyAction, type GoldTrend, type SpotSeriesPoint } from "@/lib/gold-analysis";
import { deleteGoldPriceAction, upsertGoldPriceAction } from "@/lib/actions/gold-prices";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LocalGoldPrices } from "@/lib/gold-prices";
import type { GoldBrand, GoldPrice } from "@/types";

const BRAND_LABEL: Record<GoldBrand, string> = {
  antam: "Antam",
  galeri24: "Galeri24",
  digital: "Emas Digital",
};
const BRAND_COLOR: Record<GoldBrand, string> = {
  antam: "var(--chart-1)",
  galeri24: "var(--chart-2)",
  digital: "var(--chart-3)",
};
const BRAND_ITEMS = (Object.keys(BRAND_LABEL) as GoldBrand[]).map((b) => ({ value: b, label: BRAND_LABEL[b] }));

const TREND_META: Record<GoldTrend, { label: string; Icon: typeof TrendingUp; className: string }> = {
  "naik-kuat": { label: "Naik kuat", Icon: TrendingUp, className: "text-success" },
  naik: { label: "Naik", Icon: TrendingUp, className: "text-success" },
  sideways: { label: "Sideways", Icon: Minus, className: "text-muted-foreground" },
  turun: { label: "Turun", Icon: TrendingDown, className: "text-danger" },
};

const ACTION_META: Record<BuyAction, { title: string; Icon: typeof ShoppingCart; className: string }> = {
  serok: {
    title: "Waktunya serok",
    Icon: ShoppingCart,
    className: "border-success/30 bg-success-bg/60 text-success",
  },
  cicil: {
    title: "Cicil bertahap",
    Icon: Clock,
    className: "border-warning/30 bg-warning-bg/60 text-warning",
  },
  tunggu: {
    title: "Tahan dulu, tunggu koreksi",
    Icon: AlertTriangle,
    className: "border-danger/25 bg-danger-bg/60 text-danger",
  },
};

function pct(v: number | null, digits = 1) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function compactRupiah(v: number) {
  if (Math.abs(v) >= 1e6) return `Rp${(v / 1e6).toFixed(2)}jt`;
  return formatRupiah(v);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

type BrandQuote = {
  brand: GoldBrand;
  sell: number;
  buyback: number | null;
  // Rasio harga merek terhadap harga emas dunia pada tanggal kutipan, dipakai untuk
  // menerjemahkan tren/proyeksi harga dunia ke harga merek.
  sellRatio: number;
  buybackRatio: number | null;
  date: string;
  source: string;
};

export function GoldClient({
  local,
  spot,
  history,
  tableReady,
}: {
  local: LocalGoldPrices | null;
  spot: SpotSeriesPoint[];
  history: GoldPrice[];
  tableReady: boolean;
}) {
  const analysis = useMemo(() => analyzeGold(spot), [spot]);

  function spotOn(date: string) {
    let found: number | null = null;
    for (const p of spot) {
      if (p.date <= date) found = p.idrPerGram;
      else break;
    }
    return found ?? spot[0]?.idrPerGram ?? null;
  }

  // Harga terbaru per merek: live dari Galeri24 untuk Antam/Galeri24, lalu riwayat tersimpan.
  const quotes = useMemo(() => {
    const result: BrandQuote[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const brand of ["antam", "galeri24", "digital"] as GoldBrand[]) {
      const live = brand !== "digital" ? local?.[brand].find((r) => r.weight === 1) : undefined;
      const saved = [...history].reverse().find((h) => h.brand === brand);
      const quote = live
        ? { sell: live.sell, buyback: live.buyback, date: spot.at(-1)?.date ?? today, source: "galeri24.co.id (live)" }
        : saved
          ? {
              sell: Number(saved.sell_price),
              buyback: saved.buyback_price != null ? Number(saved.buyback_price) : null,
              date: saved.price_date,
              source: `${saved.source === "manual" ? "input manual" : "tersimpan"}${saved.platform ? ` · ${saved.platform}` : ""}, ${formatDate(saved.price_date)}`,
            }
          : null;
      if (!quote) continue;
      const base = spotOn(quote.date);
      if (!base) continue;
      result.push({
        brand,
        ...quote,
        sellRatio: quote.sell / base,
        buybackRatio: quote.buyback != null ? quote.buyback / base : null,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, history, spot]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    const prices = spot.map((p) => p.idrPerGram);
    const start = Math.max(0, spot.length - 252);
    const rows: {
      date: string;
      harga?: number;
      sma50?: number;
      sma200?: number;
      proyeksi?: number;
      kisaran?: [number, number];
    }[] = [];
    for (let i = start; i < spot.length; i++) {
      const avg = (n: number) => (i + 1 >= n ? prices.slice(i + 1 - n, i + 1).reduce((s, x) => s + x, 0) / n : undefined);
      rows.push({ date: spot[i].date, harga: Math.round(prices[i]), sma50: avg(50), sma200: avg(200) });
    }
    const last = rows[rows.length - 1];
    last.proyeksi = last.harga;
    last.kisaran = [last.harga!, last.harga!];
    // Titik mingguan sampai 2 bulan (±42 hari bursa ≈ 60 hari kalender).
    for (let week = 1; week <= 9; week++) {
      const months = (week * 5) / 21;
      const mid = analysis.monthlyDrift * months;
      const band = analysis.monthlyVol * Math.sqrt(months);
      rows.push({
        date: addDays(analysis.lastDate, week * 7),
        proyeksi: Math.round(analysis.last * Math.exp(mid)),
        kisaran: [Math.round(analysis.last * Math.exp(mid - band)), Math.round(analysis.last * Math.exp(mid + band))],
      });
    }
    return rows;
  }, [analysis, spot]);

  const historyChart = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const h of history) {
      const row = byDate.get(h.price_date) ?? { date: h.price_date };
      row[h.brand] = Number(h.sell_price);
      byDate.set(h.price_date, row);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [history]);

  const cheapestSize = (rows: LocalGoldPrices["antam"] | undefined) =>
    rows && rows.length ? Math.min(...rows.map((r) => r.sell / r.weight)) : null;

  if (!analysis) {
    return (
      <div>
        <Header />
        <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          Data harga emas dunia sedang tidak tersedia (Yahoo Finance gagal diakses). Muat ulang halaman
          beberapa menit lagi. Harga lokal tetap bisa dicatat di bawah.
        </div>
        <PriceForm tableReady={tableReady} />
      </div>
    );
  }

  const action = ACTION_META[analysis.action];
  const trend = TREND_META[analysis.trend];

  return (
    <div>
      <Header />

      {!tableReady && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg/50 p-4 text-sm">
          Tabel <code>gold_prices</code> belum ada di database — jalankan migration{" "}
          <code>0007_gold_prices.sql</code> agar riwayat harga lokal bisa tersimpan.
        </div>
      )}

      {/* ---------- Keputusan ---------- */}
      <div className={cn("rounded-lg border p-5", action.className)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <action.Icon className="h-6 w-6" />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide opacity-80">Keputusan saat ini</div>
              <div className="font-[family-name:var(--font-heading)] text-xl font-semibold">{action.title}</div>
            </div>
          </div>
          <div className="text-right text-xs text-foreground">
            <div className="text-muted-foreground">Tren harga emas dunia</div>
            <div className={cn("flex items-center justify-end gap-1 text-sm font-semibold", trend.className)}>
              <trend.Icon className="h-4 w-4" /> {trend.label}
            </div>
          </div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
          {analysis.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>
            {analysis.action === "serok"
              ? "Bagus untuk beli lebih banyak dari biasanya (mis. 1,5–2× jatah bulanan)."
              : analysis.action === "tunggu"
                ? "Tetap cicil kecil bila rutin, tapi simpan dana tambahan sampai harga kembali ke zona serok."
                : "Beli jatah rutin seperti biasa; tambah porsi hanya bila harga masuk zona serok."}
          </li>
        </ul>
        {quotes.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-foreground sm:grid-cols-3">
            {quotes.map((q) => {
              const zone = analysis.buyZone * q.sellRatio;
              const current = analysis.last * q.sellRatio;
              const inZone = current <= zone * 1.005;
              return (
                <div key={q.brand} className="rounded-md border border-border bg-card/80 p-3">
                  <div className="text-xs text-muted-foreground">Zona serok {BRAND_LABEL[q.brand]} (1 gram)</div>
                  <div className="font-[family-name:var(--font-mono)] text-base font-semibold">
                    ≤ {formatRupiah(Math.round(zone / 1000) * 1000)}
                  </div>
                  <div className={cn("text-xs", inZone ? "text-success" : "text-muted-foreground")}>
                    {inZone
                      ? "Harga sekarang sudah di zona ini"
                      : `Sekarang ±${formatRupiah(Math.round(current / 1000) * 1000)} (${pct((current / zone - 1) * 100)} di atas)`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Ringkasan ---------- */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Emas dunia / gram" value={formatRupiah(analysis.last)} />
        <StatCard
          label="1 bulan"
          value={pct(analysis.change1m)}
          tone={analysis.change1m == null ? "neutral" : analysis.change1m >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="3 bulan"
          value={pct(analysis.change3m)}
          tone={analysis.change3m == null ? "neutral" : analysis.change3m >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="1 tahun"
          value={pct(analysis.change1y)}
          tone={analysis.change1y == null ? "neutral" : analysis.change1y >= 0 ? "success" : "danger"}
        />
        <StatCard label="RSI 14 hari" value={analysis.rsi14.toFixed(0)} />
      </div>

      {/* ---------- Grafik tren + proyeksi ---------- */}
      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Harga Emas Dunia per Gram — 12 Bulan + Proyeksi 2 Bulan</div>
          <div className="text-xs text-muted-foreground">
            COMEX × kurs USD/IDR, data per {formatDate(analysis.lastDate)}
          </div>
        </div>
        <div className="mb-3 text-xs text-muted-foreground">
          Rata-rata 50 hari {formatRupiah(analysis.sma50)}
          {analysis.sma200 != null && ` · 200 hari ${formatRupiah(analysis.sma200)}`} · Terendah 20 hari{" "}
          {formatRupiah(analysis.low20)}
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickFormatter={shortDate}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickFormatter={(v) => compactRupiah(Number(v))}
                domain={["auto", "auto"]}
                width={72}
              />
              <Tooltip
                labelFormatter={(v) => formatDate(String(v))}
                formatter={(value, name) =>
                  Array.isArray(value)
                    ? [`${formatRupiah(Number(value[0]))} – ${formatRupiah(Number(value[1]))}`, name]
                    : [formatRupiah(Number(value)), name]
                }
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="kisaran" name="Kisaran wajar (±1σ)" stroke="none" fill="var(--chart-1)" fillOpacity={0.15} isAnimationActive={false} />
              <Line dataKey="harga" name="Harga / gram" stroke="var(--foreground)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
              <Line dataKey="sma50" name="Rata-rata 50 hari" stroke="var(--warning)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="sma200" name="Rata-rata 200 hari" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="proyeksi" name="Proyeksi tren" stroke="var(--chart-1)" strokeDasharray="5 3" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---------- Proyeksi per merek ---------- */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
        <div className="mb-3 text-sm font-medium">Perkiraan Harga Beli 1 Gram, 1–2 Bulan ke Depan</div>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Merek</th>
              <th className="py-2 pr-3 text-right font-medium">Sekarang</th>
              {analysis.projections.map((p) => (
                <th key={p.months} className="py-2 pr-3 text-right font-medium">
                  {p.months} bulan lagi (kisaran)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[{ brand: null as GoldBrand | null, sellRatio: 1 }, ...quotes].map((q) => (
              <tr key={q.brand ?? "dunia"} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium">{q.brand ? BRAND_LABEL[q.brand] : "Emas dunia"}</td>
                <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                  {formatRupiah(analysis.last * q.sellRatio)}
                </td>
                {analysis.projections.map((p) => (
                  <td key={p.months} className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {formatRupiah(p.mid * q.sellRatio)}
                    <div className="text-[11px] text-muted-foreground">
                      {compactRupiah(p.low * q.sellRatio)} – {compactRupiah(p.high * q.sellRatio)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Proyeksi = tren 3–6 bulan terakhir yang diredam 50%; kisaran = ±1σ volatilitas (sekitar 2 dari 3
          kemungkinan). Harga merek dihitung dari harga dunia × premi merek saat ini. Ini gambaran
          kemungkinan, bukan kepastian.
        </p>
      </div>

      {/* ---------- Perbandingan merek ---------- */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Perbandingan Merek (per gram)</div>
          {local?.updatedText && (
            <div className="text-xs text-muted-foreground">Galeri24 diperbarui {local.updatedText}</div>
          )}
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Merek</th>
              <th className="py-2 pr-3 text-right font-medium">Harga beli</th>
              <th className="py-2 pr-3 text-right font-medium">Buyback</th>
              <th className="py-2 pr-3 text-right font-medium">Premi vs dunia</th>
              <th className="py-2 pr-3 text-right font-medium">Selisih jual–beli</th>
              <th className="py-2 text-right font-medium">
                Perkiraan balik modal
                <div className="font-normal">
                  (rata-rata naik {((Math.exp(analysis.longRunMonthlyDrift * 12) - 1) * 100).toFixed(1)}%/thn, 2 thn terakhir)
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {(["antam", "galeri24", "digital"] as GoldBrand[]).map((brand) => {
              const q = quotes.find((x) => x.brand === brand);
              if (!q) {
                return (
                  <tr key={brand} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{BRAND_LABEL[brand]}</td>
                    <td colSpan={5} className="py-2.5 text-right text-xs text-muted-foreground">
                      {brand === "digital"
                        ? "Belum ada data — catat harga beli & jual dari aplikasi emas digital Anda di form di bawah."
                        : "Harga tidak tersedia — isi manual di form di bawah."}
                    </td>
                  </tr>
                );
              }
              const sellNow = analysis.last * q.sellRatio;
              const buybackNow = q.buybackRatio != null ? analysis.last * q.buybackRatio : null;
              const spreadPct = buybackNow != null ? (1 - buybackNow / sellNow) * 100 : null;
              const neededLog = buybackNow != null ? Math.log(sellNow / buybackNow) : null;
              const months =
                neededLog != null && analysis.longRunMonthlyDrift > 0 ? neededLog / analysis.longRunMonthlyDrift : null;
              return (
                <tr key={brand} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{BRAND_LABEL[brand]}</div>
                    <div className="text-xs text-muted-foreground">{q.source}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">{formatRupiah(q.sell)}</td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {q.buyback != null ? formatRupiah(q.buyback) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {pct((q.sellRatio - 1) * 100)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {spreadPct != null ? `${spreadPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2.5 text-right text-xs">
                    {neededLog == null
                      ? "—"
                      : months == null
                        ? `Perlu naik ${((Math.exp(neededLog) - 1) * 100).toFixed(1)}%`
                        : `Perlu naik ${((Math.exp(neededLog) - 1) * 100).toFixed(1)}% · ±${months < 1 ? "<1" : Math.ceil(months)} bulan`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            <b>Selisih jual–beli</b> adalah biaya terbesar emas: harga harus naik sebesar itu dulu sebelum
            Anda untung saat menjual. Karena itu emas cocok untuk simpanan ≥1–2 tahun, bukan jual-beli
            jangka pendek.
          </li>
          <li>
            Untuk serok rutin nominal kecil, emas digital biasanya paling efisien (bisa mulai dari ribuan
            rupiah, selisih kecil). Untuk fisik, bandingkan premi Galeri24 vs Antam — Antam umumnya lebih
            mahal tapi paling mudah dijual kembali.
          </li>
          {local && (
            <li>
              Harga per gram termurah sesuai ukuran: Antam{" "}
              {cheapestSize(local.antam) != null ? formatRupiah(cheapestSize(local.antam)!) : "—"}, Galeri24{" "}
              {cheapestSize(local.galeri24) != null ? formatRupiah(cheapestSize(local.galeri24)!) : "—"} —
              kepingan besar lebih murah per gram tapi lebih sulit dijual sebagian.
            </li>
          )}
        </ul>
      </div>

      {/* ---------- Ukuran kepingan ---------- */}
      {local && (local.antam.length > 0 || local.galeri24.length > 0) && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Harga per Gram Menurut Ukuran Kepingan</div>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Berat</th>
                <th className="py-2 pr-3 text-right font-medium">Antam (harga)</th>
                <th className="py-2 pr-3 text-right font-medium">Antam / gram</th>
                <th className="py-2 pr-3 text-right font-medium">Galeri24 (harga)</th>
                <th className="py-2 text-right font-medium">Galeri24 / gram</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set([...local.antam, ...local.galeri24].map((r) => r.weight))]
                .sort((a, b) => a - b)
                .filter((w) => w <= 100)
                .map((w) => {
                  const a = local.antam.find((r) => r.weight === w);
                  const g = local.galeri24.find((r) => r.weight === w);
                  return (
                    <tr key={w} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{w.toLocaleString("id-ID")} g</td>
                      <td className="py-2 pr-3 text-right font-[family-name:var(--font-mono)]">{a ? formatRupiah(a.sell) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                        {a ? formatRupiah(a.sell / w) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-[family-name:var(--font-mono)]">{g ? formatRupiah(g.sell) : "—"}</td>
                      <td className="py-2 text-right font-[family-name:var(--font-mono)] text-muted-foreground">
                        {g ? formatRupiah(g.sell / w) : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Riwayat harga lokal + input ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-1 text-sm font-medium">Riwayat Harga Beli Lokal (1 gram)</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Antam & Galeri24 tercatat otomatis sekali sehari setiap halaman ini dibuka; emas digital dari
            input Anda.
          </p>
          {historyChart.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Riwayat belum cukup untuk digambar — akan terisi seiring hari.
            </p>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={shortDate} minTickGap={30} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v) => compactRupiah(Number(v))}
                    domain={["auto", "auto"]}
                    width={72}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatDate(String(v))}
                    formatter={(value) => formatRupiah(Number(value))}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(Object.keys(BRAND_LABEL) as GoldBrand[]).map((b) => (
                    <Line key={b} dataKey={b} name={BRAND_LABEL[b]} stroke={BRAND_COLOR[b]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <HistoryList history={history} />
        </div>
        <PriceForm tableReady={tableReady} />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-5 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Metode (best practice yang dipakai)</div>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Harga Antam, Galeri24 dan emas digital semuanya mengikuti <b>harga emas dunia × kurs Rupiah</b>{" "}
            ditambah premi. Karena itu tren dibaca dari harga dunia (riwayat 2 tahun), lalu diterjemahkan
            ke tiap merek.
          </li>
          <li>
            <b>Tren:</b> harga vs rata-rata 50 & 200 hari. Naik kuat = harga &gt; rata-rata 50 hari &gt;
            rata-rata 200 hari; turun = kebalikannya.
          </li>
          <li>
            <b>Waktu serok:</b> saat tren besar naik tetapi harga sedang koreksi ke sekitar rata-rata 50
            hari, atau RSI ≤ 40. <b>Tahan dulu:</b> saat RSI ≥ 70 atau harga &gt;6% di atas rata-rata 50
            hari. Di luar itu: cicil rutin.
          </li>
          <li>
            <b>Proyeksi 1–2 bulan:</b> gabungan regresi 90 hari (50%) dan momentum 3 & 6 bulan (25% + 25%),
            diredam 50%, dengan kisaran ±1σ dari volatilitas 60 hari terakhir.
          </li>
          <li>
            Yang paling menentukan untung adalah <b>disiplin cicil + menambah saat koreksi</b> dan memilih
            merek dengan selisih jual–beli kecil, bukan menebak harga harian.
          </li>
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Disclaimer: halaman ini adalah alat bantu analisis pribadi, bukan nasihat keuangan profesional
        resmi. Harga dari pihak ketiga bisa terlambat atau berbeda dengan harga di gerai/aplikasi; selalu
        cek harga final sebelum bertransaksi.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Tren & Waktu Beli Emas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Antam, Galeri24 dan emas digital — tren terkini, perkiraan 1–2 bulan, dan kapan sebaiknya serok.
      </p>
    </div>
  );
}

function HistoryList({ history }: { history: GoldPrice[] }) {
  const manual = [...history].filter((h) => h.source === "manual").reverse().slice(0, 8);
  if (manual.length === 0) return null;

  async function remove(id: string) {
    try {
      await deleteGoldPriceAction(id);
      toast.success("Catatan harga dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-medium">Input manual terakhir</div>
      <div className="divide-y divide-border/60 text-sm">
        {manual.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-2 py-1.5">
            <div>
              <span className="font-medium">{BRAND_LABEL[h.brand]}</span>
              {h.platform && <span className="text-xs text-muted-foreground"> · {h.platform}</span>}
              <span className="text-xs text-muted-foreground"> · {formatDate(h.price_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-mono)] text-xs">
                {formatRupiah(Number(h.sell_price))}
                {h.buyback_price != null && ` / ${formatRupiah(Number(h.buyback_price))}`}
              </span>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="text-muted-foreground hover:text-danger"
                aria-label="Hapus catatan harga"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceForm({ tableReady }: { tableReady: boolean }) {
  const [brand, setBrand] = useState<GoldBrand>("digital");
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())
  );
  const [sell, setSell] = useState("");
  const [buyback, setBuyback] = useState("");
  const [platform, setPlatform] = useState("Pegadaian Tabungan Emas");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await upsertGoldPriceAction({
        brand,
        price_date: date,
        sell_price: Number(sell),
        buyback_price: buyback.trim() === "" ? null : Number(buyback),
        platform: brand === "digital" ? platform : null,
      });
      toast.success("Harga emas dicatat");
      setSell("");
      setBuyback("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div>
        <div className="text-sm font-medium">Catat Harga Manual</div>
        <p className="text-xs text-muted-foreground">
          Untuk emas digital (harga dari aplikasi Anda) atau bila harga otomatis tidak tersedia. Isi harga
          per 1 gram.
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Merek</Label>
        <Select items={BRAND_ITEMS} value={brand} onValueChange={(v) => v && setBrand(v as GoldBrand)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAND_ITEMS.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {brand === "digital" && (
        <div className="space-y-1">
          <Label className="text-xs">Platform</Label>
          <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="mis. Pegadaian, Treasury, Pluang" />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Tanggal</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Harga beli / gram</Label>
          <Input type="number" min={1} value={sell} onChange={(e) => setSell(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Buyback / gram</Label>
          <Input type="number" min={0} value={buyback} onChange={(e) => setBuyback(e.target.value)} placeholder="opsional" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting || !tableReady}>
        {submitting ? "Menyimpan…" : "Simpan Harga"}
      </Button>
      {!tableReady && <p className="text-xs text-danger">Jalankan migration 0007 terlebih dahulu.</p>}
    </form>
  );
}
