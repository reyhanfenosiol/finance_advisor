"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EducationPlanDialog } from "@/components/investasi/education-plan-dialog";
import {
  BUCKETS,
  buildGoals,
  contributionTimeline,
  defaultPlan,
  TIER_LABEL,
  yearlyCosts,
  type EducationPlanInput,
  type Goal,
} from "@/lib/education-plan";
import type { EducationPlan, Investment } from "@/types";

const CHILD_COLORS = ["var(--chart-1)", "var(--chart-2)"];

function compactRupiah(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `Rp${(v / 1e9).toFixed(1)}M`;
  if (abs >= 1e6) return `Rp${(v / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}jt`;
  if (abs >= 1e3) return `Rp${(v / 1e3).toFixed(0)}rb`;
  return formatRupiah(v);
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function yearsLabel(y: number) {
  if (y < 1) return `${Math.max(0, Math.round(y * 12))} bln`;
  return `${y.toFixed(1).replace(".", ",")} thn`;
}

export function EducationClient({
  plan,
  tableReady,
  investments,
  investmentValues,
}: {
  plan: EducationPlan | null;
  tableReady: boolean;
  investments: Investment[];
  investmentValues: Record<string, number>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [childCount, setChildCount] = useState<1 | 2>(1);

  const settings: EducationPlanInput = useMemo(() => {
    if (!plan) return defaultPlan();
    const base = defaultPlan();
    const children = plan.children.length >= 2 ? plan.children : [...plan.children, base.children[1]];
    return {
      children,
      costs: { ...base.costs, ...plan.costs },
      education_inflation_pct: Number(plan.education_inflation_pct),
      fund_full_school: plan.fund_full_school,
      investment_ids: plan.investment_ids ?? [],
    };
  }, [plan]);

  const currentFund = settings.investment_ids.reduce((s, id) => s + Math.max(0, investmentValues[id] ?? 0), 0);

  const scenarios = useMemo(
    () =>
      ([1, 2] as const).map((n) => {
        const goals = buildGoals(settings, n, currentFund);
        const upcoming = goals.filter((g) => g.status === "akan-datang");
        const years = yearlyCosts(settings, n);
        return {
          n,
          goals,
          monthlyNow: upcoming.reduce((s, g) => s + g.monthlyContribution, 0),
          totalTarget: upcoming.reduce((s, g) => s + g.target, 0),
          peakYear: years.reduce((best, [y, v]) => (v[0] + v[1] > best.total ? { year: y, total: v[0] + v[1] } : best), {
            year: 0,
            total: 0,
          }),
          years,
          timeline: contributionTimeline(goals),
        };
      }),
    [settings, currentFund]
  );

  const active = scenarios[childCount - 1];
  const phase1 = active.goals.filter((g) => g.stage.phase === 1);
  const phase2 = active.goals.filter((g) => g.stage.phase === 2);

  const costChart = active.years.map(([year, v]) => ({
    year: String(year),
    anak1: Math.round(v[0]),
    anak2: Math.round(v[1]),
  }));
  const timelineChart = scenarios[0].timeline.map((r, i) => ({
    year: String(r.year),
    satu: Math.round(r.total),
    dua: Math.round(scenarios[1].timeline[i]?.total ?? 0),
  }));
  // contributionTimeline untuk 2 anak bisa lebih panjang; pastikan semua tahun tampil.
  for (const r of scenarios[1].timeline.slice(scenarios[0].timeline.length)) {
    timelineChart.push({ year: String(r.year), satu: 0, dua: Math.round(r.total) });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Dana Pendidikan Anak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Persiapan biaya TK → SD → SMP sekarang, dan SMA → kuliah untuk jangka panjang. Inflasi pendidikan{" "}
            {settings.education_inflation_pct}%/tahun.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>{plan ? "Atur Rencana" : "Buat Rencana"}</Button>
      </div>

      {!tableReady ? (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg/50 p-4 text-sm">
          Tabel <code>education_plans</code> belum ada di database — jalankan migration{" "}
          <code>0008_education_plans.sql</code> di Supabase agar rencana bisa disimpan. Angka di bawah memakai
          contoh.
        </div>
      ) : (
        !plan && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg/50 p-4 text-sm">
            Angka di bawah memakai <b>contoh</b>: anak 1 berusia 2 tahun, anak 2 lahir tahun depan, sekolah
            swasta menengah, kuliah di PTN. Klik <b>Buat Rencana</b> untuk mengisi data anak Anda.
          </div>
        )
      )}

      {/* ---------- Skenario 1 vs 2 anak ---------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setChildCount(s.n)}
            className={cn(
              "rounded-lg border bg-card p-5 text-left transition-colors",
              childCount === s.n ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Skenario {s.n} anak
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({settings.children.slice(0, s.n).map((c) => c.name).join(" & ")})
                </span>
              </div>
              {childCount === s.n && (
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
                  Ditampilkan
                </span>
              )}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Investasi yang perlu disisihkan mulai sekarang</div>
            <div className="font-[family-name:var(--font-mono)] text-2xl font-semibold">
              {formatRupiah(Math.round(s.monthlyNow / 1000) * 1000)}
              <span className="text-sm font-normal text-muted-foreground"> /bulan</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Total dana yang harus siap</div>
                <div className="font-[family-name:var(--font-mono)] font-medium">{compactRupiah(s.totalTarget)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Tahun terberat</div>
                <div className="font-[family-name:var(--font-mono)] font-medium">
                  {s.peakYear.year > 0 ? `${s.peakYear.year} · ${compactRupiah(s.peakYear.total)}` : "—"}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Dana pendidikan yang sudah terkumpul: <b className="text-foreground">{formatRupiah(currentFund)}</b>
        {settings.investment_ids.length === 0 && " (belum ada instrumen yang ditautkan — atur di Atur Rencana)"}.
        Setoran per bulan akan turun sendiri setiap kali satu jenjang sudah terbayar.
      </p>

      {/* ---------- Panduan pemula ---------- */}
      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-3 text-sm font-medium">Panduan Singkat untuk Pemula</div>
        <ol className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Pisahkan rekeningnya",
              "Buat rekening/akun reksa dana khusus pendidikan agar tidak terpakai untuk kebutuhan lain.",
            ],
            [
              "Jarak waktu menentukan instrumen",
              "Butuh < 3 tahun lagi → instrumen aman (pasar uang, deposito, SBN). Masih > 5 tahun → boleh saham lewat reksa dana indeks.",
            ],
            [
              "Mulai sedini mungkin",
              "Biaya sekolah naik ±10%/tahun. Menunda 3 tahun bisa membuat setoran bulanan naik 40–60%.",
            ],
            [
              "Lindungi rencananya",
              "Punya asuransi jiwa berjangka (term life) untuk pencari nafkah, agar dana tetap terkumpul bila terjadi risiko.",
            ],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-md bg-muted/50 p-3">
              <div className="font-medium">
                {i + 1}. {title}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{body}</div>
            </li>
          ))}
        </ol>
      </div>

      {/* ---------- Tahap 1 ---------- */}
      <GoalTable
        title="Tahap 1 — TK, SD, SMP (kebutuhan terdekat)"
        subtitle="Jarak waktunya pendek, jadi utamakan instrumen yang nilainya stabil. Jangan pakai saham atau crypto untuk dana yang dipakai < 3 tahun lagi."
        goals={phase1}
        settings={settings}
        showChild={childCount === 2}
      />

      {/* ---------- Tahap 2 ---------- */}
      <GoalTable
        title="Tahap 2 — SMA & Kuliah (persiapan jangka panjang)"
        subtitle="Jarak waktunya panjang, jadi boleh mengambil porsi saham lebih besar lalu dipindahkan bertahap ke instrumen aman menjelang waktunya."
        goals={phase2}
        settings={settings}
        showChild={childCount === 2}
      />

      <div className="mt-4 rounded-lg border border-border bg-card p-5">
        <div className="mb-1 text-sm font-medium">Strategi Bertahap untuk SMA & Kuliah</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Cara yang umum dipakai perencana keuangan (&quot;glide path&quot;): agresif saat waktunya masih jauh,
          lalu makin aman setiap mendekati tahun masuk agar dana tidak tergerus saat pasar sedang turun.
        </p>
        <div className="space-y-4">
          {phase2
            .filter((g) => g.status === "akan-datang")
            .map((g) => {
              const start = g.startDate.getFullYear();
              const now = new Date().getFullYear();
              const steps = [
                { from: start - 99, to: start - 10, label: "Agresif", mix: "70% reksa dana indeks saham · 20% pendapatan tetap · 10% emas" },
                { from: start - 10, to: start - 5, label: "Seimbang", mix: "50% indeks saham · 35% pendapatan tetap · 15% emas" },
                { from: start - 5, to: start - 3, label: "Konservatif", mix: "Pindahkan saham bertahap ke reksa dana pendapatan tetap & SBN" },
                { from: start - 3, to: start - 1, label: "Aman", mix: "Pasar uang + SBN ritel / deposito" },
                { from: start - 1, to: start, label: "Siap pakai", mix: "100% pasar uang / tabungan, siap untuk uang pangkal" },
              ].filter((s) => s.to > now);
              return (
                <div key={`${g.childIndex}-${g.stage.key}`}>
                  <div className="mb-1.5 text-xs font-medium">
                    {childCount === 2 && `${g.childName} · `}
                    {g.stage.label} — masuk Juli {start}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {steps.map((s, i) => (
                      <div
                        key={s.label}
                        className={cn(
                          "min-w-[150px] flex-1 rounded-md border p-2 text-xs",
                          i === 0 ? "border-primary bg-primary/5" : "border-border"
                        )}
                      >
                        <div className="font-medium">
                          {Math.max(s.from, now)}–{s.to} · {s.label}
                          {i === 0 && <span className="ml-1 text-primary">(sekarang)</span>}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">{s.mix}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            <b>Kuliah bisa jauh lebih murah</b> lewat PTN jalur SNBP/SNBT (UKT sesuai kemampuan) atau KIP Kuliah,
            tapi tetap siapkan dana seolah membayar penuh — beasiswa adalah bonus, bukan rencana.
          </li>
          <li>
            Bila anak akan kuliah di luar kota, tambahkan biaya kos & makan (±Rp2–4 juta/bulan saat ini) ke
            &quot;lain-lain per tahun&quot; kuliah.
          </li>
          <li>Tinjau ulang rencana setahun sekali dan naikkan setoran ±10% setiap gaji naik.</li>
        </ul>
      </div>

      {/* ---------- Grafik ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 text-sm font-medium">Biaya Pendidikan per Tahun ({childCount} anak)</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Seluruh biaya (uang pangkal + SPP + lain-lain) sudah termasuk inflasi pendidikan.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => compactRupiah(Number(v))} width={64} />
                <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="anak1" name={settings.children[0].name} stackId="a" fill={CHILD_COLORS[0]} />
                {childCount === 2 && (
                  <Bar dataKey="anak2" name={settings.children[1].name} stackId="a" fill={CHILD_COLORS[1]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 text-sm font-medium">Setoran Investasi per Bulan: 1 vs 2 Anak</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Setoran turun setiap ada jenjang yang dananya sudah terpenuhi.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => compactRupiah(Number(v))} width={64} />
                <Tooltip formatter={(v) => `${formatRupiah(Number(v))}/bulan`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="stepAfter" dataKey="satu" name="1 anak" stroke={CHILD_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="stepAfter" dataKey="dua" name="2 anak" stroke={CHILD_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ---------- Instrumen menurut jarak waktu ---------- */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
        <div className="mb-3 text-sm font-medium">Instrumen yang Sebaiknya Dipakai, Menurut Jarak Waktu</div>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Dana dipakai</th>
              <th className="py-2 pr-3 font-medium">Instrumen</th>
              <th className="py-2 pr-3 font-medium">Contoh komposisi</th>
              <th className="py-2 pr-3 font-medium">Risiko</th>
              <th className="py-2 text-right font-medium">Asumsi return/thn</th>
            </tr>
          </thead>
          <tbody>
            {BUCKETS.map((b) => (
              <tr key={b.key} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium">{b.label} lagi</td>
                <td className="py-2.5 pr-3">{b.instruments}</td>
                <td className="py-2.5 pr-3 text-xs text-muted-foreground">{b.mix}</td>
                <td className="py-2.5 pr-3 text-xs">{b.risk}</td>
                <td className="py-2.5 text-right font-[family-name:var(--font-mono)]">{b.returnPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">Kenapa instrumen ini?</div>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Reksa dana bisa mulai dari Rp10 ribu–100 ribu, diawasi OJK, dan mudah dicairkan.</li>
              <li>SBN ritel (ORI, SR, ST) dijamin negara, kupon lebih tinggi dari deposito.</li>
              <li>Reksa dana indeks saham biayanya rendah dan mengikuti pertumbuhan ekonomi dalam jangka panjang.</li>
              <li>Emas sebagai pelengkap (10–15%) untuk penyeimbang, bukan instrumen utama.</li>
            </ul>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 font-medium">Sebaiknya dihindari untuk dana pendidikan</div>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Crypto dan saham individual — terlalu fluktuatif untuk tujuan dengan tanggal pasti.</li>
              <li>
                Asuransi pendidikan/unit link — biaya tinggi dan hasilnya kalah dari kombinasi reksa dana + asuransi
                jiwa berjangka.
              </li>
              <li>Tabungan biasa untuk jangka panjang — bunganya kalah dari inflasi pendidikan.</li>
              <li>Investasi dengan janji imbal hasil pasti tinggi — cek legalitasnya di OJK.</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Disclaimer: halaman ini adalah alat bantu perencanaan pribadi, bukan nasihat keuangan profesional resmi.
        Biaya sekolah, inflasi, dan return investasi hanya perkiraan; sesuaikan dengan sekolah incaran dan tinjau
        ulang setiap tahun.
      </p>

      <EducationPlanDialog
        key={`${plan?.updated_at ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={settings}
        investments={investments}
        investmentValues={investmentValues}
        tableReady={tableReady}
      />
    </div>
  );
}

function GoalTable({
  title,
  subtitle,
  goals,
  settings,
  showChild,
}: {
  title: string;
  subtitle: string;
  goals: Goal[];
  settings: EducationPlanInput;
  showChild: boolean;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium">{title}</div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Jenjang</th>
            <th className="py-2 pr-3 font-medium">Masuk</th>
            <th className="py-2 pr-3 text-right font-medium">Biaya hari ini*</th>
            <th className="py-2 pr-3 text-right font-medium">Dana harus siap</th>
            <th className="py-2 pr-3 text-right font-medium">SPP/bln saat itu</th>
            <th className="py-2 pr-3 font-medium">Instrumen disarankan</th>
            <th className="py-2 text-right font-medium">Setoran/bulan</th>
          </tr>
        </thead>
        <tbody>
          {goals.map((g) => {
            const cost = settings.costs[g.stage.key];
            const tierLabel = cost.tier === "custom" ? "Biaya sendiri" : TIER_LABEL[g.stage.key][cost.tier];
            const done = g.status !== "akan-datang";
            return (
              <tr
                key={`${g.childIndex}-${g.stage.key}`}
                className={cn("border-b border-border/60 last:border-0", done && "text-muted-foreground")}
              >
                <td className="py-2.5 pr-3">
                  <div className="font-medium">
                    {showChild && <span style={{ color: CHILD_COLORS[g.childIndex] }}>{g.childName} · </span>}
                    {g.stage.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{tierLabel}</div>
                </td>
                <td className="py-2.5 pr-3">
                  Juli {g.startDate.getFullYear()}
                  <div className="text-xs text-muted-foreground">
                    {g.status === "akan-datang"
                      ? `${yearsLabel(g.yearsUntil)} lagi · usia ${g.stage.entryAge}`
                      : g.status === "berjalan"
                        ? "Sedang berjalan"
                        : "Selesai"}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">{compactRupiah(g.costToday)}</td>
                <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)] font-semibold text-foreground">
                  {done ? "—" : formatRupiah(Math.round(g.target / 1000) * 1000)}
                </td>
                <td className="py-2.5 pr-3 text-right font-[family-name:var(--font-mono)]">
                  {g.monthlyFeeAtEntry > 0 ? compactRupiah(g.monthlyFeeAtEntry) : "—"}
                  {g.unfundedNote && g.monthlyFeeAtEntry > 0 && !done && (
                    <div className="text-[10.5px] text-muted-foreground">dari gaji</div>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs">
                  {done ? (
                    g.status === "berjalan" ? "Dibayar dari cashflow bulanan" : "—"
                  ) : (
                    <>
                      <div>{g.bucket.instruments}</div>
                      <div className="text-muted-foreground">
                        Risiko {g.bucket.risk.toLowerCase()} · asumsi {g.bucket.returnPct}%/thn
                      </div>
                    </>
                  )}
                </td>
                <td className="py-2.5 text-right font-[family-name:var(--font-mono)] font-semibold">
                  {done ? "—" : formatRupiah(Math.round(g.monthlyContribution / 1000) * 1000)}
                  {!done && g.allocated > 0 && (
                    <div className="text-[10.5px] font-normal text-success">
                      terbantu dana {compactRupiah(g.allocated)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        *Uang pangkal + biaya tahun pertama dengan harga sekarang.{" "}
        {settings.fund_full_school
          ? "Dana harus siap mencakup seluruh biaya jenjang."
          : "Dana harus siap = uang pangkal + biaya tahun pertama (kuliah: seluruh 4 tahun). SPP tahun berikutnya dibayar dari gaji."}
      </p>
    </div>
  );
}
