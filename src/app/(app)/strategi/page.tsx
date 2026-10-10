import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { buildStrategy, HORIZON_LABEL, TYPE_LABEL, type Action, type Horizon } from "@/lib/strategy";

const HORIZONS: Horizon[] = ["minggu-ini", "30-hari", "3-bulan", "6-12-bulan", "rutin"];
const TYPE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const PARETO_COUNT = 3;

export default async function StrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const since = new Date();
  since.setMonth(since.getMonth() - 13, 1);

  const [
    { data: investments },
    { data: investmentTx },
    { data: valuations },
    { data: cashTx },
    educationPlan,
    cryptoPlan,
    { data: inflation },
  ] = await Promise.all([
    supabase.from("investments").select("id, instrument_type, instrument_name, ownership"),
    supabase.from("investment_transactions").select("investment_id, type, amount, transaction_date"),
    supabase.from("investment_valuations").select("investment_id, valuation_date, current_value"),
    supabase
      .from("transactions")
      .select("type, category, amount, transaction_date")
      .gte("transaction_date", since.toISOString().slice(0, 10)),
    supabase.from("education_plans").select("id").maybeSingle(),
    supabase.from("crypto_plans").select("id").maybeSingle(),
    supabase.from("inflation_data").select("inflation_yoy").order("period", { ascending: false }).limit(1),
  ]);

  const today = new Date();
  const s = buildStrategy({
    today,
    investments: investments ?? [],
    investmentTx: investmentTx ?? [],
    valuations: valuations ?? [],
    cashTx: cashTx ?? [],
    hasEducationPlan: !!educationPlan.data,
    hasCryptoPlan: !!cryptoPlan.data,
    inflationPct: inflation?.[0] ? Number(inflation[0].inflation_yoy) : null,
  });

  const pareto = s.actions.slice(0, PARETO_COUNT);
  const paretoIds = new Set(pareto.map((a) => a.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Strategi Prioritas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prinsip Pareto: sedikit langkah yang memberi dampak terbesar pada keuangan Anda. Dihitung otomatis dari
          data per {formatDate(today)} — prioritas berubah saat data diperbarui.
        </p>
      </div>

      {/* ---------- 20% terpenting ---------- */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" />
          {PARETO_COUNT} langkah paling berdampak — kerjakan ini dulu
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {pareto.map((a, i) => (
            <div key={a.id} className="flex flex-col rounded-md border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{HORIZON_LABEL[a.horizon]}</div>
                  <div className="font-medium leading-snug">{a.title}</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.why}</p>
              {a.progress && <Progress {...a.progress} />}
              <div className="mt-2 text-sm">
                <span className="font-medium">Langkah pertama: </span>
                {a.steps[0]}
              </div>
              {a.link && <ActionLink {...a.link} />}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Kondisi saat ini ---------- */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total aset tercatat" value={formatRupiah(s.totalAssets)} />
        <StatCard
          label="Dana darurat (target 6 bulan)"
          value={s.emergencyMonths != null ? `${s.emergencyMonths.toFixed(1).replace(".", ",")} bulan` : "—"}
          tone={s.emergencyMonths == null ? "neutral" : s.emergencyMonths >= 6 ? "success" : "danger"}
        />
        <StatCard
          label="Porsi aset terbesar"
          value={s.topType ? `${TYPE_LABEL[s.topType.type] ?? s.topType.type} ${s.topType.pct.toFixed(0)}%` : "—"}
          tone={s.topType && s.topType.pct > 50 ? "danger" : "neutral"}
        />
        <StatCard
          label="Pengeluaran rata-rata/bulan"
          value={s.avgMonthlyExpense != null ? formatRupiah(s.avgMonthlyExpense) : "—"}
        />
        <StatCard
          label="Rasio tabungan"
          value={s.savingsRate != null ? `${(s.savingsRate * 100).toFixed(0)}%` : "Belum terukur"}
          tone={s.savingsRate == null ? "danger" : s.savingsRate >= 0.2 ? "success" : "danger"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 text-sm font-medium">Komposisi Aset</div>
          <div className="mb-2 flex h-4 overflow-hidden rounded-full bg-muted">
            {s.totalAssets > 0 && (
              <div
                className="h-full bg-muted-foreground/50"
                style={{ width: `${(s.liquid / s.totalAssets) * 100}%` }}
                title="Tabungan & deposito"
              />
            )}
            {s.allocation.map((a, i) => (
              <div
                key={a.type}
                className="h-full"
                style={{ width: `${(a.value / s.totalAssets) * 100}%`, background: TYPE_COLORS[i % TYPE_COLORS.length] }}
                title={TYPE_LABEL[a.type] ?? a.type}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-muted-foreground/50" />
              Tabungan & deposito {formatRupiah(s.liquid)} ({s.totalAssets > 0 ? ((s.liquid / s.totalAssets) * 100).toFixed(0) : 0}%)
            </span>
            {s.allocation.map((a, i) => (
              <span key={a.type}>
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                {TYPE_LABEL[a.type] ?? a.type} {formatRupiah(a.value)} ({((a.value / s.totalAssets) * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Patokan sehat untuk jangka panjang: dana darurat 6 bulan terpisah, lalu investasi tersebar — mis. reksa
            dana saham/indeks 40–60%, pendapatan tetap/SBN 20–40%, emas 10–30%, aset spekulatif ≤ 10%.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 text-sm font-medium">Pareto Pengeluaran</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Kategori yang menyerap ±80% pengeluaran ({s.expenseMonthsUsed} bulan dengan data lengkap).
          </p>
          {s.expensePareto.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data pengeluaran.</p>
          ) : (
            <div className="space-y-2">
              {s.expensePareto
                .filter((c, i) => i < 3 || c.cumPct - c.pct < 80)
                .slice(0, 6)
                .map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs">
                      <span>{c.category}</span>
                      <span className="font-[family-name:var(--font-mono)]">{c.pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: "var(--chart-1)" }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Timeline ---------- */}
      <div className="mt-6 mb-3">
        <div className="text-sm font-medium">Timeline Langkah</div>
        <p className="text-xs text-muted-foreground">
          Semua langkah diurutkan dari yang harus dikerjakan paling dulu. Titik menunjukkan besarnya dampak.
        </p>
      </div>
      <div className="space-y-4">
        {HORIZONS.map((h) => {
          const list = s.actions.filter((a) => a.horizon === h);
          if (list.length === 0) return null;
          return (
            <div key={h} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr]">
              <div className="md:pt-4">
                <div className="text-sm font-semibold">{HORIZON_LABEL[h]}</div>
                <div className="text-xs text-muted-foreground">{list.length} langkah</div>
              </div>
              <div className="space-y-3">
                {list.map((a) => (
                  <ActionCard key={a.id} action={a} isPareto={paretoIds.has(a.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Disclaimer: halaman ini adalah alat bantu perencanaan pribadi yang dihitung otomatis dari data yang Anda
        catat, bukan nasihat keuangan profesional resmi. Untuk keputusan besar (menjual aset, membeli asuransi),
        pertimbangkan berkonsultasi dengan perencana keuangan bersertifikat.
      </p>
    </div>
  );
}

function ImpactDots({ impact }: { impact: number }) {
  return (
    <span className="flex items-center gap-0.5" title={`Dampak ${impact}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i <= impact ? "bg-primary" : "bg-muted")} />
      ))}
    </span>
  );
}

function Progress({ current, target, label }: { current: number; target: number; label: string }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-[family-name:var(--font-mono)]">
          {formatRupiah(current)} / {formatRupiah(target)}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-warning" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function ActionCard({ action: a, isPareto }: { action: Action; isPareto: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", isPareto ? "border-primary/40" : "border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{a.title}</div>
        <div className="flex items-center gap-2">
          {isPareto && (
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] text-primary-foreground">Prioritas</span>
          )}
          <ImpactDots impact={a.impact} />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{a.why}</p>
      {a.progress && <Progress {...a.progress} />}
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        {a.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {a.link && <ActionLink {...a.link} />}
    </div>
  );
}
