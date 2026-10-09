"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Flame } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { CryptoPlanDialog } from "@/components/investasi/crypto-plan-dialog";
import type { CryptoPlanInput } from "@/lib/actions/crypto-plan";
import type {
  CryptoPlan,
  InflationData,
  Investment,
  InvestmentTransaction,
  InvestmentValuation,
} from "@/types";

const DEFAULT_INFLATION = 3;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function defaultPlan(): CryptoPlanInput {
  return {
    monthly_dca_amount: 500000,
    start_date: new Date().toISOString().slice(0, 10),
    horizon_years: 20,
    max_portfolio_pct: 10,
    rebalance_threshold_pct: 10,
    return_pessimistic: 0,
    return_moderate: 15,
    return_optimistic: 30,
    allocations: [
      { symbol: "BTC", coingecko_id: "bitcoin", target_pct: 80, investment_id: null, manual_price: null },
      { symbol: "ETH", coingecko_id: "ethereum", target_pct: 20, investment_id: null, manual_price: null },
    ],
  };
}

function compactRupiah(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `Rp${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `Rp${(v / 1e9).toFixed(1)}M`;
  if (abs >= 1e6) return `Rp${(v / 1e6).toFixed(0)}jt`;
  return formatRupiah(v);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type PriceSource = "live" | "manual" | "valuasi" | "modal";

export function CryptoPlanClient({
  plan,
  investments,
  transactions,
  valuations,
  latestInflation,
  livePrices,
}: {
  plan: CryptoPlan | null;
  investments: Investment[];
  transactions: InvestmentTransaction[];
  valuations: InvestmentValuation[];
  latestInflation: InflationData | null;
  livePrices: Record<string, number>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const settings: CryptoPlanInput = plan
    ? {
        monthly_dca_amount: Number(plan.monthly_dca_amount),
        start_date: plan.start_date,
        horizon_years: plan.horizon_years,
        max_portfolio_pct: Number(plan.max_portfolio_pct),
        rebalance_threshold_pct: Number(plan.rebalance_threshold_pct),
        return_pessimistic: Number(plan.return_pessimistic),
        return_moderate: Number(plan.return_moderate),
        return_optimistic: Number(plan.return_optimistic),
        allocations: plan.allocations,
      }
    : defaultPlan();

  const cryptoInstruments = investments.filter((i) => i.instrument_type === "crypto");
  const cryptoIds = new Set(cryptoInstruments.map((i) => i.id));

  function instrumentStats(investmentId: string) {
    const txs = transactions.filter((t) => t.investment_id === investmentId);
    let invested = 0;
    let units = 0;
    let unitsKnown = txs.length > 0;
    let buyAmount = 0;
    let buyUnits = 0;
    for (const t of txs) {
      const amount = Number(t.amount);
      invested += t.type === "buy" ? amount : -amount;
      if (t.units == null) {
        unitsKnown = false;
        continue;
      }
      const u = Number(t.units);
      units += t.type === "buy" ? u : -u;
      if (t.type === "buy") {
        buyAmount += amount;
        buyUnits += u;
      }
    }
    const latestVal = valuations
      .filter((v) => v.investment_id === investmentId)
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
    return {
      invested,
      units: unitsKnown ? units : null,
      avgPrice: buyUnits > 0 ? buyAmount / buyUnits : null,
      latestValuation: latestVal ? Number(latestVal.current_value) : null,
    };
  }

  // Nilai per baris alokasi, plus instrumen crypto yang belum ditautkan ke alokasi mana pun.
  const holdings = useMemo(() => {
    const linked = new Set<string>();
    const rows = settings.allocations.map((a) => {
      const stats = a.investment_id ? instrumentStats(a.investment_id) : null;
      if (a.investment_id) linked.add(a.investment_id);
      const live = livePrices[a.coingecko_id];
      const price = live ?? a.manual_price ?? null;
      let value = 0;
      let source: PriceSource = "modal";
      if (stats && stats.units != null && price != null) {
        value = stats.units * price;
        source = live != null ? "live" : "manual";
      } else if (stats?.latestValuation != null) {
        value = stats.latestValuation;
        source = "valuasi";
      } else if (stats) {
        value = stats.invested;
      }
      return {
        key: a.symbol,
        symbol: a.symbol,
        instrumentName: cryptoInstruments.find((i) => i.id === a.investment_id)?.instrument_name ?? null,
        targetPct: Number(a.target_pct),
        invested: stats?.invested ?? 0,
        units: stats?.units ?? null,
        avgPrice: stats?.avgPrice ?? null,
        price,
        priceIsLive: live != null,
        value,
        source,
      };
    });
    const unlinked = cryptoInstruments
      .filter((i) => !linked.has(i.id))
      .map((i) => {
        const stats = instrumentStats(i.id);
        return {
          key: i.id,
          symbol: "—",
          instrumentName: i.instrument_name,
          targetPct: 0,
          invested: stats.invested,
          units: stats.units,
          avgPrice: stats.avgPrice,
          price: null as number | null,
          priceIsLive: false,
          value: stats.latestValuation ?? stats.invested,
          source: (stats.latestValuation != null ? "valuasi" : "modal") as PriceSource,
        };
      })
      .filter((r) => r.invested !== 0 || r.value !== 0);
    return { rows, unlinked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, investments, transactions, valuations, livePrices]);

  const allRows = [...holdings.rows, ...holdings.unlinked];
  const cryptoValue = allRows.reduce((s, r) => s + r.value, 0);
  const cryptoInvested = allRows.reduce((s, r) => s + r.invested, 0);
  const cryptoReturn = cryptoValue - cryptoInvested;
  const cryptoReturnPct = cryptoInvested > 0 ? (cryptoReturn / cryptoInvested) * 100 : 0;

  const nonCryptoValue = investments
    .filter((i) => !cryptoIds.has(i.id))
    .reduce((s, i) => {
      const st = instrumentStats(i.id);
      return s + (st.latestValuation ?? st.invested);
    }, 0);
  const totalPortfolio = nonCryptoValue + cryptoValue;
  const cryptoSharePct = totalPortfolio > 0 ? (cryptoValue / totalPortfolio) * 100 : 0;
  const overLimit = cryptoSharePct > settings.max_portfolio_pct;

  const rebalanceAlerts = holdings.rows
    .map((r) => {
      const actualPct = cryptoValue > 0 ? (r.value / cryptoValue) * 100 : 0;
      return { ...r, actualPct, deviation: actualPct - r.targetPct };
    })
    .filter((r) => cryptoValue > 0 && Math.abs(r.deviation) > settings.rebalance_threshold_pct);

  // ---------- Kepatuhan DCA ----------
  const dca = useMemo(() => {
    const buysByMonth = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "buy" || !cryptoIds.has(t.investment_id)) continue;
      const k = t.transaction_date.slice(0, 7);
      buysByMonth.set(k, (buysByMonth.get(k) ?? 0) + Number(t.amount));
    }
    const now = new Date();
    const currentKey = monthKey(now);
    const start = new Date(`${settings.start_date}T00:00:00`);
    const months: { key: string; label: string; amount: number; status: "met" | "partial" | "missed" | "current" }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (monthKey(cursor) <= currentKey) {
      const k = monthKey(cursor);
      const amount = buysByMonth.get(k) ?? 0;
      const target = settings.monthly_dca_amount;
      let status: "met" | "partial" | "missed" | "current";
      if (amount >= target && target > 0) status = "met";
      else if (k === currentKey) status = "current";
      else if (amount > 0) status = "partial";
      else status = "missed";
      months.push({
        key: k,
        label: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        amount,
        status,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    // Streak dihitung mundur; bulan berjalan yang belum terpenuhi tidak memutus streak.
    let streak = 0;
    for (let i = months.length - 1; i >= 0; i--) {
      if (months[i].status === "current") continue;
      if (months[i].status === "met") streak++;
      else break;
    }
    const closed = months.filter((m) => m.status !== "current");
    const metCount = closed.filter((m) => m.status === "met").length;
    return {
      months,
      streak,
      complianceRate: closed.length > 0 ? (metCount / closed.length) * 100 : null,
      currentMonth: months.find((m) => m.key === currentKey),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, investments, plan]);

  // ---------- Proyeksi ----------
  const inflationRate = latestInflation ? Number(latestInflation.inflation_yoy) : DEFAULT_INFLATION;
  const projection = useMemo(() => {
    const monthlyRate = (annual: number) => Math.pow(1 + annual / 100, 1 / 12) - 1;
    const rp = monthlyRate(settings.return_pessimistic);
    const rm = monthlyRate(settings.return_moderate);
    const ro = monthlyRate(settings.return_optimistic);
    const ri = monthlyRate(inflationRate);
    let p = cryptoValue;
    let m = cryptoValue;
    let o = cryptoValue;
    let invested = cryptoInvested;
    const thisYear = new Date().getFullYear();
    const data = [
      { year: String(thisYear), modal: invested, pesimis: p, moderat: m, optimis: o, moderatRiil: m },
    ];
    for (let month = 1; month <= settings.horizon_years * 12; month++) {
      p = p * (1 + rp) + settings.monthly_dca_amount;
      m = m * (1 + rm) + settings.monthly_dca_amount;
      o = o * (1 + ro) + settings.monthly_dca_amount;
      invested += settings.monthly_dca_amount;
      if (month % 12 === 0) {
        const deflator = Math.pow(1 + ri, month);
        data.push({
          year: String(thisYear + month / 12),
          modal: Math.round(invested),
          pesimis: Math.round(p),
          moderat: Math.round(m),
          optimis: Math.round(o),
          moderatRiil: Math.round(m / deflator),
        });
      }
    }
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, cryptoValue, cryptoInvested, inflationRate]);

  const finalPoint = projection[projection.length - 1];
  const hasLivePrice = Object.keys(livePrices).length > 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Rencana Crypto {settings.horizon_years} Tahun
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DCA {formatRupiah(settings.monthly_dca_amount)}/bulan sejak{" "}
            {new Date(`${settings.start_date}T00:00:00`).toLocaleDateString("id-ID", {
              month: "long",
              year: "numeric",
            })}{" "}
            · Target{" "}
            {settings.allocations.map((a) => `${a.symbol} ${a.target_pct}%`).join(" / ")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>{plan ? "Atur Rencana" : "Buat Rencana"}</Button>
      </div>

      {!plan && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg/50 p-4 text-sm">
          Rencana belum disimpan — angka di bawah memakai pengaturan default (DCA Rp500.000/bulan,
          BTC 80% / ETH 20%). Klik <b>Buat Rencana</b> untuk menyesuaikan dan menautkan instrumen
          crypto Anda.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Nilai Crypto Saat Ini" value={formatRupiah(cryptoValue)} />
        <StatCard label="Modal Crypto Disetor" value={formatRupiah(cryptoInvested)} />
        <StatCard
          label="Return"
          value={`${cryptoReturn >= 0 ? "+" : ""}${formatRupiah(cryptoReturn)} (${
            cryptoReturnPct >= 0 ? "+" : ""
          }${cryptoReturnPct.toFixed(1)}%)`}
          tone={cryptoInvested === 0 ? "neutral" : cryptoReturn >= 0 ? "success" : "danger"}
        />
        <StatCard
          label={`Porsi dari Portofolio (batas ${settings.max_portfolio_pct}%)`}
          value={`${cryptoSharePct.toFixed(1)}%`}
          tone={overLimit ? "danger" : "neutral"}
        />
      </div>

      {(overLimit || rebalanceAlerts.length > 0) && (
        <div className="mt-4 space-y-2">
          {overLimit && (
            <div className="flex gap-2.5 rounded-lg border border-danger/25 bg-danger-bg/50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div>
                Porsi crypto {cryptoSharePct.toFixed(1)}% melebihi batas {settings.max_portfolio_pct}%
                dari total portofolio ({formatRupiah(totalPortfolio)}). Pertimbangkan menahan DCA
                sementara atau memindahkan sekitar{" "}
                <b>
                  {formatRupiah(cryptoValue - (settings.max_portfolio_pct / 100) * totalPortfolio)}
                </b>{" "}
                ke aset lain.
              </div>
            </div>
          )}
          {rebalanceAlerts.map((r) => (
            <div
              key={r.key}
              className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning-bg/50 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <b>Rebalancing {r.symbol}:</b> porsi aktual {r.actualPct.toFixed(1)}% vs target{" "}
                {r.targetPct}% (selisih {r.deviation > 0 ? "+" : ""}
                {r.deviation.toFixed(1)}%, ambang ±{settings.rebalance_threshold_pct}%).{" "}
                {r.deviation > 0
                  ? `Kurangi sekitar ${formatRupiah((r.deviation / 100) * cryptoValue)}, atau arahkan DCA berikutnya ke koin lain.`
                  : `Tambah sekitar ${formatRupiah((-r.deviation / 100) * cryptoValue)}, misalnya lewat DCA bulan depan.`}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Simulasi Nilai {settings.horizon_years} Tahun</div>
          <div className="text-xs text-muted-foreground">
            Inflasi {inflationRate.toFixed(1)}%/thn
            {latestInflation ? ` (data ${latestInflation.period})` : " (asumsi default)"}
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          {(
            [
              ["Modal disetor", finalPoint.modal],
              [`Pesimis (${settings.return_pessimistic}%)`, finalPoint.pesimis],
              [`Moderat (${settings.return_moderate}%)`, finalPoint.moderat],
              [`Optimis (${settings.return_optimistic}%)`, finalPoint.optimis],
              ["Moderat, nilai riil", finalPoint.moderatRiil],
            ] as const
          ).map(([label, v]) => (
            <div key={label}>
              <div className="text-muted-foreground">{label}</div>
              <div className="font-[family-name:var(--font-mono)] text-sm font-semibold">
                {compactRupiah(v)}
              </div>
            </div>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickFormatter={(v) => compactRupiah(Number(v))}
                width={70}
              />
              <Tooltip
                formatter={(value) => formatRupiah(Number(value))}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="modal" name="Modal Disetor" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pesimis" name="Pesimis" stroke="var(--danger)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="moderat" name="Moderat" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="optimis" name="Optimis" stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="moderatRiil" name="Moderat (riil, setelah inflasi)" stroke="var(--chart-3)" strokeDasharray="2 3" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Simulasi berangkat dari nilai crypto saat ini + DCA tetap tiap bulan dengan return tahunan
          konstan. Kenyataannya crypto bisa turun 70–80% dalam satu siklus; garis ini bukan prediksi.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium">Kepatuhan DCA</div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-warning" /> Streak <b className="text-foreground">{dca.streak} bulan</b>
              </span>
              {dca.complianceRate != null && (
                <span>
                  Konsisten <b className="text-foreground">{dca.complianceRate.toFixed(0)}%</b>
                </span>
              )}
            </div>
          </div>
          {dca.currentMonth && (
            <p className="mb-3 text-sm">
              {dca.currentMonth.status === "met" ? (
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-4 w-4" /> DCA bulan ini sudah terpenuhi (
                  {formatRupiah(dca.currentMonth.amount)}).
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Bulan ini baru {formatRupiah(dca.currentMonth.amount)} dari target{" "}
                  {formatRupiah(settings.monthly_dca_amount)} — sisa{" "}
                  <b className="text-foreground">
                    {formatRupiah(Math.max(0, settings.monthly_dca_amount - dca.currentMonth.amount))}
                  </b>
                  .
                </span>
              )}
            </p>
          )}
          {dca.months.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tanggal mulai DCA ada di masa depan.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {dca.months.slice(-36).map((m) => (
                <div
                  key={m.key}
                  title={`${m.label}: ${formatRupiah(m.amount)}`}
                  className={cn(
                    "w-[58px] rounded-md border px-1.5 py-1 text-center text-[10.5px] leading-tight",
                    m.status === "met" && "border-success/30 bg-success-bg text-success",
                    m.status === "partial" && "border-warning/30 bg-warning-bg text-warning",
                    m.status === "missed" && "border-danger/25 bg-danger-bg/60 text-danger",
                    m.status === "current" && "border-dashed border-border text-muted-foreground"
                  )}
                >
                  {m.label}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-success" />Terpenuhi</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-warning" />Sebagian</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-danger" />Terlewat</span>
            <span>Pembelian dihitung dari transaksi beli instrumen bertipe Crypto.</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <div className="mb-3 font-medium">Prinsip Rencana</div>
          <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
            <li>Dana darurat 3–6 bulan & bebas utang konsumtif sebelum menambah crypto.</li>
            <li>Porsi crypto maksimal {settings.max_portfolio_pct}% dari total portofolio.</li>
            <li>Fokus aset besar (BTC/ETH); hindari altcoin kecil untuk horizon panjang.</li>
            <li>DCA rutin apa pun harganya — jangan coba menebak timing pasar.</li>
            <li>Rebalancing tahunan atau saat alokasi menyimpang &gt; ±{settings.rebalance_threshold_pct}%.</li>
            <li>Gunakan exchange terdaftar OJK; simpan jumlah besar di hardware wallet.</li>
            <li>Catat semua transaksi untuk keperluan pajak (PPh final & PPN kripto).</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">Kepemilikan & Alokasi</div>
          <div className="text-xs text-muted-foreground">
            {hasLivePrice ? "Harga live dari CoinGecko (cache 5 menit)" : "Harga live tidak tersedia — memakai harga manual/valuasi"}
          </div>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Koin</th>
              <th className="py-2 pr-3 text-right font-medium">Unit</th>
              <th className="py-2 pr-3 text-right font-medium">Harga Rata-rata Beli</th>
              <th className="py-2 pr-3 text-right font-medium">Harga Sekarang</th>
              <th className="py-2 pr-3 text-right font-medium">Modal</th>
              <th className="py-2 pr-3 text-right font-medium">Nilai</th>
              <th className="py-2 text-right font-medium">Aktual / Target</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((r) => {
              const actualPct = cryptoValue > 0 ? (r.value / cryptoValue) * 100 : 0;
              const drift = r.targetPct > 0 && Math.abs(actualPct - r.targetPct) > settings.rebalance_threshold_pct;
              return (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">{r.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.instrumentName ?? "Belum ditautkan ke instrumen"}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {r.units != null ? r.units.toLocaleString("id-ID", { maximumFractionDigits: 8 }) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {r.avgPrice != null ? formatRupiah(r.avgPrice) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {r.price != null ? formatRupiah(r.price) : "—"}
                    {r.price != null && (
                      <div className="text-[10.5px] text-muted-foreground">
                        {r.priceIsLive ? "live" : "manual"}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {formatRupiah(r.invested)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                    {formatRupiah(r.value)}
                    {r.source !== "live" && r.source !== "manual" && r.invested !== 0 && (
                      <div className="text-[10.5px] text-muted-foreground">
                        {r.source === "valuasi" ? "dari valuasi terakhir" : "= modal (belum ada harga)"}
                      </div>
                    )}
                  </td>
                  <td className={cn("py-2.5 text-right font-[family-name:var(--font-mono)]", drift && "text-warning")}>
                    {actualPct.toFixed(1)}% / {r.targetPct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cryptoInstruments.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada instrumen bertipe Crypto. Tambahkan di menu <b>Input & Tabel Investasi</b>{" "}
            (isi jumlah unit saat membeli agar nilai bisa dihitung dari harga live), lalu tautkan di{" "}
            <b>Atur Rencana</b>.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Disclaimer: halaman ini adalah alat bantu perencanaan pribadi, bukan nasihat keuangan
        profesional resmi. Aset kripto berisiko tinggi dan nilainya bisa turun drastis.
      </p>

      <CryptoPlanDialog
        key={`${plan?.updated_at ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={settings}
        cryptoInstruments={cryptoInstruments}
      />
    </div>
  );
}
