"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { CryptoMarket } from "@/lib/crypto-prices";

const CORE_IDS = ["bitcoin", "ethereum"];
const HOURS_PER_WEEK = 168;
// Tren jangka pendek cenderung memudar; proyeksi hanya memakai separuh drift.
const DRIFT_DAMPING = 0.5;
const ROUNDING = 10000;

type Signal = "naik" | "sideways" | "turun";

type Analysis = {
  market: CryptoMarket;
  isCore: boolean;
  weeklyVol: number; // log-return, 1σ per minggu
  regressionWeekly: number; // kemiringan regresi log-harga, per minggu
  priceVsSma: number; // harga terakhir vs rata-rata 7 hari
  composite: number; // estimasi drift mingguan gabungan
  score: number; // drift / volatilitas (risk-adjusted)
  signal: Signal;
  projMid: number;
  projLow: number;
  projHigh: number;
};

function analyze(m: CryptoMarket): Analysis {
  const prices = m.sparkline7d;
  const logs = prices.map((p) => Math.log(p));
  const rets = logs.slice(1).map((l, i) => l - logs[i]);
  const meanRet = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - meanRet) ** 2, 0) / Math.max(1, rets.length - 1);
  const weeklyVol = Math.sqrt(variance) * Math.sqrt(HOURS_PER_WEEK);

  // Regresi linear log-harga terhadap jam — lebih tahan noise dibanding titik awal vs akhir.
  const n = logs.length;
  const xMean = (n - 1) / 2;
  const yMean = logs.reduce((s, l) => s + l, 0) / n;
  let num = 0;
  let den = 0;
  logs.forEach((l, i) => {
    num += (i - xMean) * (l - yMean);
    den += (i - xMean) ** 2;
  });
  const regressionWeekly = (den > 0 ? num / den : 0) * HOURS_PER_WEEK;

  const sma = prices.reduce((s, p) => s + p, 0) / n;
  const priceVsSma = prices[n - 1] / sma - 1;

  const r7 = m.change7d != null ? Math.log(1 + m.change7d / 100) : regressionWeekly;
  const r30Weekly = m.change30d != null ? (Math.log(1 + m.change30d / 100) * 7) / 30 : r7;
  const composite = 0.5 * regressionWeekly + 0.25 * r7 + 0.25 * r30Weekly;
  const score = weeklyVol > 0 ? composite / weeklyVol : 0;

  let signal: Signal = "sideways";
  if (score > 0.2 && priceVsSma > 0) signal = "naik";
  else if (score < -0.2 && priceVsSma < 0) signal = "turun";

  const drift = composite * DRIFT_DAMPING;
  return {
    market: m,
    isCore: CORE_IDS.includes(m.id),
    weeklyVol,
    regressionWeekly,
    priceVsSma,
    composite,
    score,
    signal,
    projMid: m.priceIdr * Math.exp(drift),
    projLow: m.priceIdr * Math.exp(drift - weeklyVol),
    projHigh: m.priceIdr * Math.exp(drift + weeklyVol),
  };
}

// 1 koin inti (BTC/ETH dengan skor terbaik) + 1 satelit (skor terbaik di antara sisanya).
// Bila satelit sedang tren turun, kembali ke pasangan defensif BTC + ETH.
function pickPair(list: Analysis[]): [string, string] | null {
  const cores = list.filter((a) => a.isCore).sort((a, b) => b.score - a.score);
  if (cores.length === 0) {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    return sorted.length >= 2 ? [sorted[0].market.id, sorted[1].market.id] : null;
  }
  const core = cores[0];
  const rest = list.filter((a) => a.market.id !== core.market.id).sort((a, b) => b.score - a.score);
  if (rest.length === 0) return null;
  let satellite = rest[0];
  const otherCore = cores[1];
  if (satellite.signal === "turun" && otherCore) satellite = otherCore;
  return [core.market.id, satellite.market.id];
}

// Porsi berbasis kebalikan volatilitas (risk parity), dengan koin inti minimal 60%, maksimal 80%.
function splitCapital(capital: number, first: Analysis, second: Analysis) {
  const invA = 1 / Math.max(first.weeklyVol, 1e-6);
  const invB = 1 / Math.max(second.weeklyVol, 1e-6);
  let wA = invA / (invA + invB);
  if (first.isCore && !second.isCore) wA = Math.min(0.8, Math.max(0.6, wA));
  else if (!first.isCore && second.isCore) wA = Math.min(0.4, Math.max(0.2, wA));
  const amountA = Math.round((capital * wA) / ROUNDING) * ROUNDING;
  return [amountA, capital - amountA] as const;
}

function executionPlan(a: Analysis, amount: number) {
  if (a.signal === "naik") {
    return `Tren mendukung — boleh beli sekaligus ${formatRupiah(amount)} minggu ini. Jangan kejar harga bila sudah naik >${(a.weeklyVol * 100).toFixed(0)}% dalam sehari.`;
  }
  if (a.signal === "sideways") {
    const half = Math.round(amount / 2 / ROUNDING) * ROUNDING;
    return `Belum ada arah jelas — beli 2 tahap: ${formatRupiah(half)} sekarang dan ${formatRupiah(amount - half)} 3–4 hari lagi.`;
  }
  const part = Math.round(amount / 3 / ROUNDING) * ROUNDING;
  return `Sedang turun — pecah jadi 3 pembelian sepanjang minggu (±${formatRupiah(part)} tiap 2–3 hari). Hindari masuk sekaligus saat harga masih jatuh.`;
}

const SIGNAL_META: Record<Signal, { label: string; className: string; Icon: typeof TrendingUp }> = {
  naik: { label: "Naik", className: "border-success/30 bg-success-bg text-success", Icon: TrendingUp },
  sideways: { label: "Sideways", className: "border-border bg-muted text-muted-foreground", Icon: Minus },
  turun: { label: "Turun", className: "border-danger/25 bg-danger-bg/60 text-danger", Icon: TrendingDown },
};

function pct(v: number, digits = 1) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function SignalBadge({ signal }: { signal: Signal }) {
  const { label, className, Icon } = SIGNAL_META[signal];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", className)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// Grafik: 7 hari ke belakang (aktual) + 7 hari ke depan (ekstrapolasi + kisaran ±1σ),
// dalam % relatif terhadap harga sekarang.
function TrendChart({ a }: { a: Analysis }) {
  const data = useMemo(() => {
    const prices = a.market.sparkline7d;
    const last = prices[prices.length - 1];
    const step = Math.max(1, Math.round(prices.length / 28));
    const rows: { x: number; label: string; aktual?: number; proyeksi?: number; kisaran?: [number, number] }[] = [];
    for (let i = 0; i < prices.length; i += step) {
      const hoursAgo = prices.length - 1 - i;
      rows.push({ x: -hoursAgo / 24, label: `H-${(hoursAgo / 24).toFixed(0)}`, aktual: (prices[i] / last - 1) * 100 });
    }
    rows.push({ x: 0, label: "Hari ini", aktual: 0, proyeksi: 0, kisaran: [0, 0] });
    const drift = a.composite * DRIFT_DAMPING;
    for (let d = 1; d <= 7; d++) {
      const t = d / 7;
      const mid = drift * t;
      const band = a.weeklyVol * Math.sqrt(t);
      rows.push({
        x: d,
        label: `H+${d}`,
        proyeksi: (Math.exp(mid) - 1) * 100,
        kisaran: [(Math.exp(mid - band) - 1) * 100, (Math.exp(mid + band) - 1) * 100],
      });
    }
    return rows;
  }, [a]);

  const color = a.signal === "naik" ? "var(--success)" : a.signal === "turun" ? "var(--danger)" : "var(--chart-1)";

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[-7, 7]}
            ticks={[-7, -3.5, 0, 3.5, 7]}
            tickFormatter={(v) => (v === 0 ? "Hari ini" : v < 0 ? `H${v}` : `H+${v}`)}
            tick={{ fontSize: 10 }}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            stroke="var(--muted-foreground)"
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            width={44}
          />
          <Tooltip
            labelFormatter={(v) => {
              const x = Number(v);
              return x === 0 ? "Hari ini" : x < 0 ? `${Math.abs(x).toFixed(1)} hari lalu` : `${x} hari ke depan`;
            }}
            formatter={(value, name) =>
              Array.isArray(value)
                ? [`${pct(Number(value[0]))} s/d ${pct(Number(value[1]))}`, name]
                : [pct(Number(value)), name]
            }
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
          <Area dataKey="kisaran" name="Kisaran ±1σ" stroke="none" fill={color} fillOpacity={0.12} isAnimationActive={false} />
          <Line dataKey="aktual" name="7 hari terakhir" stroke="var(--foreground)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <Line dataKey="proyeksi" name="Ekstrapolasi tren" stroke={color} strokeDasharray="4 3" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CryptoRecommendation({ markets, defaultCapital }: { markets: CryptoMarket[]; defaultCapital: number }) {
  const [capitalInput, setCapitalInput] = useState(String(defaultCapital));
  const capital = Math.max(0, Number(capitalInput.replace(/\D/g, "")) || 0);

  const analyses = useMemo(
    () => markets.filter((m) => m.sparkline7d.length > 24).map(analyze).sort((a, b) => b.score - a.score),
    [markets]
  );
  const recommended = useMemo(() => pickPair(analyses), [analyses]);
  const [override, setOverride] = useState<string[] | null>(null);
  const selectedIds = override ?? recommended ?? [];

  function toggle(id: string) {
    if (selectedIds.includes(id)) return;
    // Selalu 2 instrumen: koin baru menggantikan pilihan yang paling lama.
    setOverride(selectedIds.length >= 2 ? [selectedIds[1], id] : [...selectedIds, id]);
  }

  const selected = selectedIds
    .map((id) => analyses.find((a) => a.market.id === id))
    .filter((a): a is Analysis => !!a)
    // Koin inti ditampilkan lebih dulu.
    .sort((a, b) => Number(b.isCore) - Number(a.isCore));
  const amounts = selected.length === 2 ? splitCapital(capital, selected[0], selected[1]) : null;
  const isRecommended =
    recommended != null && selectedIds.length === 2 && recommended.every((id) => selectedIds.includes(id));
  const lastUpdated = analyses[0]?.market.lastUpdated;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Rekomendasi Alokasi Modal ke 2 Instrumen</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Berdasarkan tren 7 hari terakhir (data per jam CoinGecko) dan ekstrapolasi 7 hari ke depan.
            {lastUpdated &&
              ` Data per ${new Date(lastUpdated).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Modal
          <Input
            inputMode="numeric"
            value={capital ? capital.toLocaleString("id-ID") : ""}
            onChange={(e) => setCapitalInput(e.target.value)}
            className="h-8 w-36 text-right font-[family-name:var(--font-mono)]"
          />
        </label>
      </div>

      {analyses.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Data pasar dari CoinGecko sedang tidak tersedia (mungkin terkena rate limit). Muat ulang halaman
          beberapa menit lagi.
        </p>
      ) : (
        <>
          {amounts && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {selected.map((a, i) => (
                <div key={a.market.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.market.symbol}</span>
                        <span className="text-xs text-muted-foreground">{a.market.name}</span>
                        <SignalBadge signal={a.signal} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {a.isCore ? "Inti (core)" : "Satelit"} · {formatRupiah(a.market.priceIdr)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-[family-name:var(--font-mono)] text-xl font-semibold">
                        {formatRupiah(amounts[i])}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {capital > 0 ? ((amounts[i] / capital) * 100).toFixed(0) : 0}% modal
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">7 hari lalu</div>
                      <div className={cn("font-[family-name:var(--font-mono)] font-medium", (a.market.change7d ?? 0) >= 0 ? "text-success" : "text-danger")}>
                        {a.market.change7d != null ? pct(a.market.change7d) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ekstrapolasi 7 hari</div>
                      <div className={cn("font-[family-name:var(--font-mono)] font-medium", a.projMid >= a.market.priceIdr ? "text-success" : "text-danger")}>
                        {pct((a.projMid / a.market.priceIdr - 1) * 100)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Kisaran wajar (±1σ)</div>
                      <div className="font-[family-name:var(--font-mono)] font-medium">
                        {pct((a.projLow / a.market.priceIdr - 1) * 100, 0)} / {pct((a.projHigh / a.market.priceIdr - 1) * 100, 0)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <TrendChart a={a} />
                  </div>

                  <p className="mt-2 rounded-md bg-muted/60 p-2.5 text-xs">
                    <b>Cara eksekusi:</b> {executionPlan(a, amounts[i])}
                    {capital > 0 && amounts[i] > 0 && (
                      <>
                        {" "}Perkiraan dapat{" "}
                        <span className="font-[family-name:var(--font-mono)]">
                          {(amounts[i] / a.market.priceIdr).toLocaleString("id-ID", { maximumSignificantDigits: 4 })}{" "}
                          {a.market.symbol}
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-xs font-medium">
                Perbandingan kandidat{" "}
                <span className="font-normal text-muted-foreground">— klik baris untuk mengganti pilihan</span>
              </div>
              {!isRecommended && (
                <button
                  type="button"
                  onClick={() => setOverride(null)}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  Kembali ke rekomendasi
                </button>
              )}
            </div>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Koin</th>
                  <th className="py-2 pr-3 text-right font-medium">24 jam</th>
                  <th className="py-2 pr-3 text-right font-medium">7 hari</th>
                  <th className="py-2 pr-3 text-right font-medium">30 hari</th>
                  <th className="py-2 pr-3 text-right font-medium">Volatilitas/minggu</th>
                  <th className="py-2 pr-3 text-right font-medium">Skor tren</th>
                  <th className="py-2 text-right font-medium">Sinyal</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => {
                  const isSelected = selectedIds.includes(a.market.id);
                  return (
                    <tr
                      key={a.market.id}
                      onClick={() => toggle(a.market.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium">{a.market.symbol}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {a.isCore ? "inti" : "satelit"}
                          {recommended?.includes(a.market.id) && " · direkomendasikan"}
                        </span>
                      </td>
                      {[a.market.change24h, a.market.change7d, a.market.change30d].map((v, idx) => (
                        <td
                          key={idx}
                          className={cn(
                            "py-2 pr-3 text-right font-[family-name:var(--font-mono)]",
                            v != null && (v >= 0 ? "text-success" : "text-danger")
                          )}
                        >
                          {v != null ? pct(v) : "—"}
                        </td>
                      ))}
                      <td className="py-2 pr-3 text-right font-[family-name:var(--font-mono)]">
                        {(a.weeklyVol * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-3 text-right font-[family-name:var(--font-mono)]">
                        {a.score >= 0 ? "+" : ""}
                        {a.score.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <SignalBadge signal={a.signal} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-md border border-border p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Metode (best practice yang dipakai)</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <b>Tren 7 hari ke belakang:</b> regresi linear log-harga per jam (50%), perubahan 7 hari (25%),
                dan momentum 30 hari yang disetarakan per minggu (25%).
              </li>
              <li>
                <b>Skor tren</b> = drift mingguan ÷ volatilitas mingguan (mirip Sharpe), supaya koin yang naik
                karena sangat bergejolak tidak otomatis menang. Sinyal <i>Naik/Turun</i> perlu dikonfirmasi harga
                di atas/bawah rata-rata 7 hari.
              </li>
              <li>
                <b>7 hari ke depan</b> tidak bisa diprediksi pasti. Yang ditampilkan adalah ekstrapolasi tren
                yang diredam 50% (momentum jangka pendek cenderung memudar) plus kisaran ±1σ dari volatilitas —
                kira-kira 2 dari 3 minggu harga berada di dalam pita itu.
              </li>
              <li>
                <b>Pemilihan:</b> 1 koin inti (BTC/ETH dengan skor terbaik) + 1 satelit dengan skor tertinggi;
                bila satelit sedang tren turun, dipakai pasangan defensif BTC + ETH. Porsi dibagi berdasarkan
                kebalikan volatilitas, koin inti 60–80%, dibulatkan ke Rp10.000.
              </li>
              <li>Cek ulang setiap minggu sebelum membeli — data diperbarui tiap 30 menit.</li>
            </ul>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Disclaimer: rekomendasi ini dihitung otomatis dari data harga historis dan bukan nasihat keuangan
        profesional resmi. Pergerakan crypto jangka pendek sangat acak; gunakan hanya dana yang siap hilang.
      </p>
    </div>
  );
}
