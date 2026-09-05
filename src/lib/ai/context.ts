import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatRupiah } from "@/lib/format";

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export async function buildCashflowContext(supabase: SupabaseClient, userId: string) {
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .limit(500);

  const rows = transactions ?? [];
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  function summarize(month: string) {
    const monthRows = rows.filter((t) => t.transaction_date.slice(0, 7) === month);
    const income = monthRows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = monthRows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const byCategory = new Map<string, number>();
    for (const t of monthRows.filter((t) => t.type === "expense")) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }
    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: ${formatRupiah(amt)}`)
      .join(", ");
    return { income, expense, topCategories: topCategories || "tidak ada" };
  }

  const current = summarize(thisMonth);
  const previous = summarize(lastMonth);

  return `Ringkasan cashflow user (bulan berjalan ${thisMonth}):
- Total pemasukan: ${formatRupiah(current.income)}
- Total pengeluaran: ${formatRupiah(current.expense)}
- Saldo bersih: ${formatRupiah(current.income - current.expense)}
- Top kategori pengeluaran: ${current.topCategories}

Bulan sebelumnya (${lastMonth}):
- Total pemasukan: ${formatRupiah(previous.income)}
- Total pengeluaran: ${formatRupiah(previous.expense)}

Total transaksi tercatat (500 terakhir): ${rows.length}`;
}

const INSTRUMENT_TYPE_LABELS: Record<string, string> = {
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

export async function buildInvestmentContext(supabase: SupabaseClient, userId: string) {
  const [{ data: investments }, { data: transactions }, { data: valuations }, { data: inflation }] =
    await Promise.all([
      supabase.from("investments").select("*").eq("user_id", userId),
      supabase.from("investment_transactions").select("*").eq("user_id", userId),
      supabase.from("investment_valuations").select("*").eq("user_id", userId),
      supabase.from("inflation_data").select("*").order("period", { ascending: false }).limit(1),
    ]);

  const insts = investments ?? [];
  const txs = transactions ?? [];
  const vals = valuations ?? [];
  const latestInflation = inflation?.[0];

  function latestValuation(investmentId: string) {
    return vals
      .filter((v) => v.investment_id === investmentId)
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
  }

  function netInvested(investmentId: string) {
    return txs
      .filter((t) => t.investment_id === investmentId)
      .reduce((s, t) => s + (t.type === "buy" ? t.amount : -t.amount), 0);
  }

  function currentValue(investmentId: string) {
    const val = latestValuation(investmentId);
    return val ? val.current_value : netInvested(investmentId);
  }

  const lines = insts.map((inst) => {
    const invested = netInvested(inst.id);
    const current = currentValue(inst.id);
    const pct = invested > 0 ? (((current - invested) / invested) * 100).toFixed(1) : "0";
    return `- ${inst.instrument_name} (${inst.instrument_type}, ${inst.ownership}): modal ${formatRupiah(
      invested
    )}, nilai saat ini ${formatRupiah(current)} (${pct}%)`;
  });

  const totalInvested = insts.reduce((s, i) => s + netInvested(i.id), 0);
  const totalCurrent = insts.reduce((s, i) => s + currentValue(i.id), 0);
  const totalReturnPct =
    totalInvested > 0 ? (((totalCurrent - totalInvested) / totalInvested) * 100).toFixed(1) : "0";

  // Ownership breakdown — mirrors the "Aset Pribadi" / "Aset Keluarga" stat
  // cards on the investment dashboard.
  function ownershipSummary(ownership: "pribadi" | "keluarga") {
    const group = insts.filter((i) => i.ownership === ownership);
    const invested = group.reduce((s, i) => s + netInvested(i.id), 0);
    const current = group.reduce((s, i) => s + currentValue(i.id), 0);
    const pct = invested > 0 ? (((current - invested) / invested) * 100).toFixed(1) : "0";
    return `${formatRupiah(current)} dari modal ${formatRupiah(invested)} (${pct}%)`;
  }

  // Allocation by instrument type — mirrors the allocation pie charts
  // (Seluruh Aset / Aset Pribadi / Aset Keluarga) on the dashboard.
  function allocationSummary(group: typeof insts) {
    const byType = new Map<string, number>();
    for (const inst of group) {
      byType.set(inst.instrument_type, (byType.get(inst.instrument_type) ?? 0) + currentValue(inst.id));
    }
    const total = [...byType.values()].reduce((s, v) => s + v, 0);
    if (total <= 0) return "belum ada data";
    return [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, value]) => `${INSTRUMENT_TYPE_LABELS[type] ?? type} ${((value / total) * 100).toFixed(0)}%`)
      .join(", ");
  }

  return `Ringkasan portofolio investasi user:
- Total modal disetor: ${formatRupiah(totalInvested)}
- Total nilai portofolio saat ini: ${formatRupiah(totalCurrent)}
- Return keseluruhan: ${totalReturnPct}%

Breakdown kepemilikan (kotak performa di dashboard):
- Aset Pribadi: ${ownershipSummary("pribadi")}
- Aset Keluarga: ${ownershipSummary("keluarga")}

Alokasi aset per jenis instrumen (chart lingkaran di dashboard):
- Seluruh Aset: ${allocationSummary(insts)}
- Aset Pribadi: ${allocationSummary(insts.filter((i) => i.ownership === "pribadi"))}
- Aset Keluarga: ${allocationSummary(insts.filter((i) => i.ownership === "keluarga"))}

Rincian per instrumen:
${lines.join("\n") || "  (belum ada instrumen)"}

Data inflasi terbaru: ${
    latestInflation ? `${latestInflation.inflation_yoy}% YoY (periode ${latestInflation.period})` : "belum tersedia"
  }`;
}
