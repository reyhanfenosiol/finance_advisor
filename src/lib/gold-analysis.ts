// Analisis tren emas dari harga dunia dalam Rupiah per gram (harian, hari bursa).
// Murni perhitungan — dipakai di client component, tanpa akses jaringan.

export type SpotSeriesPoint = { date: string; idrPerGram: number };

export type GoldTrend = "naik-kuat" | "naik" | "sideways" | "turun";
export type BuyAction = "serok" | "cicil" | "tunggu";

export type GoldAnalysis = {
  last: number;
  lastDate: string;
  sma50: number;
  sma200: number | null;
  rsi14: number;
  change1m: number | null; // % (±21 hari bursa)
  change3m: number | null;
  change6m: number | null;
  change1y: number | null;
  monthlyVol: number; // 1σ log-return per bulan
  monthlyDrift: number; // estimasi drift log per bulan (sudah diredam)
  // Rata-rata kenaikan log per bulan sepanjang seluruh riwayat — dasar estimasi balik modal
  // karena emas disimpan jangka panjang, bukan mengikuti tren 1–2 bulan.
  longRunMonthlyDrift: number;
  trend: GoldTrend;
  action: BuyAction;
  reasons: string[];
  // Batas atas "zona serok": di tren naik = rata-rata 50 hari, di tren turun = titik terendah 20 hari.
  buyZone: number;
  low20: number;
  projections: { months: 1 | 2; mid: number; low: number; high: number }[];
};

const TRADING_DAYS_PER_MONTH = 21;
// Momentum jangka menengah emas cenderung bertahan, tapi tetap diredam agar tidak overconfident.
const DRIFT_DAMPING = 0.5;

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function sma(prices: number[], n: number) {
  return prices.length >= n ? mean(prices.slice(-n)) : null;
}

function changePct(prices: number[], back: number) {
  if (prices.length <= back) return null;
  return (prices[prices.length - 1] / prices[prices.length - 1 - back] - 1) * 100;
}

// RSI Wilder 14 hari.
function rsi(prices: number[], n = 14) {
  if (prices.length <= n) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

// Kemiringan regresi linear log-harga per hari bursa.
function logSlope(prices: number[]) {
  const logs = prices.map((p) => Math.log(p));
  const n = logs.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(logs);
  let num = 0;
  let den = 0;
  logs.forEach((l, i) => {
    num += (i - xMean) * (l - yMean);
    den += (i - xMean) ** 2;
  });
  return den > 0 ? num / den : 0;
}

export function analyzeGold(series: SpotSeriesPoint[]): GoldAnalysis | null {
  if (series.length < 60) return null;
  const prices = series.map((p) => p.idrPerGram);
  const last = prices[prices.length - 1];

  const sma50 = sma(prices, 50)!;
  const sma200 = sma(prices, 200);
  const rsi14 = rsi(prices.slice(-120));

  const recent = prices.slice(-61);
  const rets = recent.slice(1).map((p, i) => Math.log(p / recent[i]));
  const m = mean(rets);
  const dailyVol = Math.sqrt(rets.reduce((s, r) => s + (r - m) ** 2, 0) / Math.max(1, rets.length - 1));
  const monthlyVol = dailyVol * Math.sqrt(TRADING_DAYS_PER_MONTH);

  const reg90 = logSlope(prices.slice(-90)) * TRADING_DAYS_PER_MONTH;
  const mom3 = prices.length > 63 ? Math.log(last / prices[prices.length - 64]) / 3 : reg90;
  const mom6 = prices.length > 126 ? Math.log(last / prices[prices.length - 127]) / 6 : mom3;
  const monthlyDrift = (0.5 * reg90 + 0.25 * mom3 + 0.25 * mom6) * DRIFT_DAMPING;

  let trend: GoldTrend = "sideways";
  if (sma200 != null) {
    if (last > sma50 && sma50 > sma200) trend = "naik-kuat";
    else if (last < sma50 && sma50 < sma200) trend = "turun";
    else if (sma50 > sma200) trend = "naik";
  } else if (last > sma50 && reg90 > 0) {
    trend = "naik";
  } else if (last < sma50 && reg90 < 0) {
    trend = "turun";
  }

  const low20 = Math.min(...prices.slice(-20));
  const distFromSma50 = (last / sma50 - 1) * 100;
  const uptrend = trend === "naik" || trend === "naik-kuat";
  const reasons: string[] = [];
  let action: BuyAction = "cicil";

  if (rsi14 >= 70 || distFromSma50 > 6) {
    action = "tunggu";
    if (rsi14 >= 70) reasons.push(`RSI ${rsi14.toFixed(0)} (≥70): sudah naik cepat, rawan koreksi.`);
    if (distFromSma50 > 6) reasons.push(`Harga ${distFromSma50.toFixed(1)}% di atas rata-rata 50 hari — sedang mahal.`);
  } else if (uptrend && (last <= sma50 * 1.01 || rsi14 <= 40)) {
    action = "serok";
    reasons.push("Tren jangka panjang naik (rata-rata 50 hari di atas 200 hari).");
    if (last <= sma50 * 1.01) reasons.push("Harga turun mendekati/di bawah rata-rata 50 hari — koreksi di dalam tren naik.");
    if (rsi14 <= 40) reasons.push(`RSI ${rsi14.toFixed(0)} (≤40): momentum jual sedang jenuh.`);
  } else if (trend === "turun") {
    action = "cicil";
    reasons.push("Tren sedang turun — beli bertahap kecil-kecil, jangan sekaligus.");
  } else {
    reasons.push(
      uptrend
        ? `Tren naik, harga ${distFromSma50.toFixed(1)}% di atas rata-rata 50 hari — wajar, tidak sedang diskon.`
        : "Belum ada arah yang jelas."
    );
  }

  return {
    last,
    lastDate: series[series.length - 1].date,
    sma50,
    sma200,
    rsi14,
    change1m: changePct(prices, TRADING_DAYS_PER_MONTH),
    change3m: changePct(prices, 63),
    change6m: changePct(prices, 126),
    change1y: changePct(prices, 252),
    monthlyVol,
    monthlyDrift,
    longRunMonthlyDrift:
      Math.log(last / prices[0]) /
      Math.max(1, (Date.parse(series[series.length - 1].date) - Date.parse(series[0].date)) / (86400000 * 30.44)),
    trend,
    action,
    reasons,
    buyZone: trend === "turun" ? low20 : Math.min(sma50, last),
    low20,
    projections: ([1, 2] as const).map((months) => {
      const mid = monthlyDrift * months;
      const band = monthlyVol * Math.sqrt(months);
      return {
        months,
        mid: last * Math.exp(mid),
        low: last * Math.exp(mid - band),
        high: last * Math.exp(mid + band),
      };
    }),
  };
}
