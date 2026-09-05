"use client";

import { useMemo, useState } from "react";
import { formatRupiah } from "@/lib/format";
import type { Investment, InvestmentTransaction, InvestmentValuation, InflationData } from "@/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { AiAdvisorWidget } from "@/components/dashboard/ai-advisor-widget";
import { InflationDialog } from "@/components/dashboard/inflation-dialog";
import { ChatWidget } from "@/components/chat/chat-widget";
import { CategoryPie } from "@/components/dashboard/category-pie";
import { Button } from "@/components/ui/button";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const INSTRUMENT_LABELS: Record<string, string> = {
  saham: "Saham",
  reksadana: "Reksadana",
  obligasi: "Obligasi",
  emas: "Emas",
  crypto: "Crypto",
  deposito: "Deposito",
  tabungan: "Tabungan",
  p2p_lending: "P2P Lending",
  properti: "Properti",
  lainnya: "Lainnya",
};

function monthEnd(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export function DashboardInvestasiClient({
  investments,
  transactions,
  valuations,
  inflationData,
  userId,
}: {
  investments: Investment[];
  transactions: InvestmentTransaction[];
  valuations: InvestmentValuation[];
  inflationData: InflationData[];
  userId: string;
}) {
  const [inflationDialogOpen, setInflationDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  void userId;

  const netInvested = (asOf?: string) =>
    transactions
      .filter((t) => (asOf ? t.transaction_date <= asOf : true))
      .reduce((sum, t) => sum + (t.type === "buy" ? t.amount : -t.amount), 0);

  function latestValuation(investmentId: string, asOf?: string) {
    return valuations
      .filter((v) => v.investment_id === investmentId && (asOf ? v.valuation_date <= asOf : true))
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
  }

  function instrumentNetInvested(investmentId: string, asOf?: string) {
    return transactions
      .filter((t) => t.investment_id === investmentId && (asOf ? t.transaction_date <= asOf : true))
      .reduce((sum, t) => sum + (t.type === "buy" ? t.amount : -t.amount), 0);
  }

  function totalCurrentValue(asOf?: string) {
    return investments.reduce((sum, inst) => {
      const val = latestValuation(inst.id, asOf);
      return sum + (val ? val.current_value : instrumentNetInvested(inst.id, asOf));
    }, 0);
  }

  const totalInvested = netInvested();
  const totalValue = totalCurrentValue();
  const returnAbs = totalValue - totalInvested;
  const returnPct = totalInvested > 0 ? (returnAbs / totalInvested) * 100 : 0;

  function valueByOwnership(ownership: "pribadi" | "keluarga") {
    const group = investments.filter((i) => i.ownership === ownership);
    const invested = group.reduce((sum, inst) => sum + instrumentNetInvested(inst.id), 0);
    const value = group.reduce((sum, inst) => {
      const val = latestValuation(inst.id);
      return sum + (val ? val.current_value : instrumentNetInvested(inst.id));
    }, 0);
    return { invested, value };
  }

  const pribadi = valueByOwnership("pribadi");
  const keluarga = valueByOwnership("keluarga");

  function computeAllocation(scopeInstruments: Investment[]) {
    const byType = new Map<string, number>();
    for (const inst of scopeInstruments) {
      const val = latestValuation(inst.id);
      const value = val ? val.current_value : instrumentNetInvested(inst.id);
      byType.set(inst.instrument_type, (byType.get(inst.instrument_type) ?? 0) + value);
    }
    return [...byType.entries()]
      .map(([type, value]) => ({ name: INSTRUMENT_LABELS[type] ?? type, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  const allocationAll = useMemo(
    () => computeAllocation(investments),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investments, valuations, transactions]
  );
  const allocationPribadi = useMemo(
    () => computeAllocation(investments.filter((i) => i.ownership === "pribadi")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investments, valuations, transactions]
  );
  const allocationKeluarga = useMemo(
    () => computeAllocation(investments.filter((i) => i.ownership === "keluarga")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [investments, valuations, transactions]
  );

  const growthAndInflation = useMemo(() => {
    const months = new Set<string>();
    for (const v of valuations) months.add(v.valuation_date.slice(0, 7));
    for (const t of transactions) months.add(t.transaction_date.slice(0, 7));
    for (const i of inflationData) months.add(i.period);
    const sortedMonths = [...months].sort();

    return sortedMonths.map((period) => {
      const asOf = monthEnd(period);
      const invested = netInvested(asOf);
      const value = totalCurrentValue(asOf);
      const pct = invested > 0 ? ((value - invested) / invested) * 100 : 0;
      const inflation = inflationData.find((i) => i.period === period);
      return {
        period,
        returnPct: Number(pct.toFixed(2)),
        inflasiYoy: inflation ? inflation.inflation_yoy : null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuations, transactions, inflationData]);

  const latestInflation = inflationData[0];
  const realReturn = latestInflation ? returnPct - latestInflation.inflation_yoy : null;

  const topAllocation = allocationAll[0];
  const allocationTotal = allocationAll.reduce((s, d) => s + d.value, 0);

  const pribadiReturnPct = pribadi.invested > 0 ? ((pribadi.value - pribadi.invested) / pribadi.invested) * 100 : 0;
  const keluargaReturnPct =
    keluarga.invested > 0 ? ((keluarga.value - keluarga.invested) / keluarga.invested) * 100 : 0;

  const insight =
    totalInvested > 0
      ? `Portofolio Anda saat ini bernilai ${formatRupiah(totalValue)} dari modal ${formatRupiah(
          totalInvested
        )} (${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%).` +
        (latestInflation
          ? ` Dibanding inflasi ${latestInflation.inflation_yoy.toFixed(
              1
            )}% (${latestInflation.period}), real return Anda sekitar ${realReturn?.toFixed(1)}%.`
          : " Tambahkan data inflasi untuk melihat perbandingan real return.") +
        (pribadi.invested > 0 && keluarga.invested > 0
          ? ` Aset Pribadi (${pribadiReturnPct >= 0 ? "+" : ""}${pribadiReturnPct.toFixed(
              1
            )}%) vs Aset Keluarga (${keluargaReturnPct >= 0 ? "+" : ""}${keluargaReturnPct.toFixed(1)}%).`
          : "") +
        (topAllocation && allocationTotal > 0
          ? ` Alokasi terbesar ada di ${topAllocation.name} (${Math.round(
              (topAllocation.value / allocationTotal) * 100
            )}% dari portofolio).`
          : "")
      : "Belum ada data investasi. Tambahkan transaksi investasi untuk mulai melihat analitik portofolio.";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Dashboard Investasi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan portofolio, alokasi aset, dan perbandingan dengan inflasi
          </p>
        </div>
        <Button variant="outline" onClick={() => setInflationDialogOpen(true)}>
          Input Data Inflasi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Nilai Portofolio Saat Ini" value={formatRupiah(totalValue)} />
        <StatCard label="Total Modal Disetor" value={formatRupiah(totalInvested)} />
        <StatCard
          label="Return"
          value={`${returnAbs >= 0 ? "+" : ""}${formatRupiah(returnAbs)} (${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%)`}
          tone={returnAbs >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Aset Pribadi</div>
          <div className="mt-1.5 font-[family-name:var(--font-mono)] text-xl font-semibold">
            {formatRupiah(pribadi.value)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Modal {formatRupiah(pribadi.invested)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs font-medium text-muted-foreground">Aset Keluarga</div>
          <div className="mt-1.5 font-[family-name:var(--font-mono)] text-xl font-semibold">
            {formatRupiah(keluarga.value)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Modal {formatRupiah(keluarga.invested)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 text-sm font-medium">Return Portofolio vs Inflasi YoY</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthAndInflation}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="returnPct"
                  name="Return Portofolio (%)"
                  stroke="var(--success)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="inflasiYoy"
                  name="Inflasi YoY (%)"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {growthAndInflation.length === 0 && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Belum ada data valuasi/inflasi untuk ditampilkan.
            </p>
          )}
        </div>

        <AiAdvisorWidget
          title="Investment Advisor"
          insight={insight}
          onOpenChat={() => setChatOpen(true)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Alokasi — Seluruh Aset</div>
          <CategoryPie data={allocationAll} height="h-48" emptyMessage="Belum ada data investasi." />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Alokasi — Aset Pribadi</div>
          <CategoryPie data={allocationPribadi} height="h-48" emptyMessage="Belum ada aset pribadi." />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-medium">Alokasi — Aset Keluarga</div>
          <CategoryPie data={allocationKeluarga} height="h-48" emptyMessage="Belum ada aset keluarga." />
        </div>
      </div>

      <InflationDialog open={inflationDialogOpen} onOpenChange={setInflationDialogOpen} />
      <ChatWidget advisorType="investment" open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
