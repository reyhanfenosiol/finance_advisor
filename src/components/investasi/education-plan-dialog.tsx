"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { upsertEducationPlanAction } from "@/lib/actions/education-plan";
import {
  STAGES,
  TIER_LABEL,
  TIER_PRESETS,
  type EducationPlanInput,
  type StageCost,
  type StageKey,
  type Tier,
} from "@/lib/education-plan";
import type { Investment } from "@/types";

const TIERS: Tier[] = ["negeri", "menengah", "premium"];

export function EducationPlanDialog({
  open,
  onOpenChange,
  initial,
  investments,
  investmentValues,
  tableReady,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EducationPlanInput;
  investments: Investment[];
  investmentValues: Record<string, number>;
  tableReady: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  function setChild(i: number, patch: Partial<EducationPlanInput["children"][number]>) {
    setForm((f) => ({ ...f, children: f.children.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }

  function setCost(key: StageKey, patch: Partial<StageCost>) {
    setForm((f) => ({ ...f, costs: { ...f.costs, [key]: { ...f.costs[key], ...patch } } }));
  }

  function toggleInvestment(id: string) {
    setForm((f) => ({
      ...f,
      investment_ids: f.investment_ids.includes(id)
        ? f.investment_ids.filter((x) => x !== id)
        : [...f.investment_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await upsertEducationPlanAction(form);
      toast.success("Rencana dana pendidikan disimpan");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan rencana");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Atur Rencana Dana Pendidikan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="mb-2 text-sm font-medium">Data Anak</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {form.children.map((c, i) => (
                <div key={i} className="space-y-2 rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nama / panggilan anak {i + 1}</Label>
                    <Input value={c.name} onChange={(e) => setChild(i, { name: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {i === 0 ? "Tanggal lahir" : "Tanggal lahir / perkiraan lahir"}
                    </Label>
                    <Input
                      type="date"
                      value={c.birth_date}
                      onChange={(e) => setChild(i, { birth_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Anak 2 dipakai untuk skenario &quot;2 anak&quot;. Bila belum lahir, isi perkiraan tanggal
              lahirnya.
            </p>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Biaya per Jenjang (harga hari ini)</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Pilih jenis sekolah untuk mengisi perkiraan otomatis, lalu sesuaikan dengan brosur sekolah
              incaran. Untuk kuliah, SPP/bulan = UKT per semester ÷ 6.
            </p>
            <div className="space-y-3">
              {STAGES.map((s) => {
                const c = form.costs[s.key];
                return (
                  <div key={s.key} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {s.label}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          usia {s.entryAge}–{s.entryAge + s.years - 1} · {s.years} tahun
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {TIERS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setCost(s.key, { tier: t, ...TIER_PRESETS[s.key][t] })}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-xs",
                              c.tier === t
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {TIER_LABEL[s.key][t]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["entry_fee", "Uang pangkal"],
                          ["monthly_fee", s.key === "kuliah" ? "UKT ÷ 6 (per bulan)" : "SPP per bulan"],
                          ["yearly_other", "Lain-lain per tahun"],
                        ] as const
                      ).map(([field, label]) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            step="50000"
                            value={c[field]}
                            onChange={(e) => setCost(s.key, { tier: "custom", [field]: Number(e.target.value) })}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="infl">Inflasi biaya pendidikan (%/tahun)</Label>
              <Input
                id="infl"
                type="number"
                min={0}
                max={50}
                step="0.5"
                value={form.education_inflation_pct}
                onChange={(e) => setForm((f) => ({ ...f, education_inflation_pct: Number(e.target.value) }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Biaya sekolah di Indonesia umumnya naik 10–15% per tahun, jauh di atas inflasi umum.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Yang dibiayai dari investasi</Label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.fund_full_school}
                  onChange={(e) => setForm((f) => ({ ...f, fund_full_school: e.target.checked }))}
                />
                <span>
                  Seluruh biaya TK–SMA
                  <span className="block text-xs text-muted-foreground">
                    Tidak dicentang: hanya uang pangkal + biaya tahun pertama; SPP tahun berikutnya dibayar
                    dari gaji bulanan. Kuliah selalu dihitung penuh.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Instrumen untuk Dana Pendidikan</div>
            <p className="mb-2 text-xs text-muted-foreground">
              Centang instrumen di menu Input Investasi yang khusus disisihkan untuk pendidikan anak. Nilainya
              dihitung sebagai dana yang sudah terkumpul.
            </p>
            {investments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada instrumen investasi.</p>
            ) : (
              <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {investments.map((inv) => (
                  <label key={inv.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={form.investment_ids.includes(inv.id)}
                      onChange={() => toggleInvestment(inv.id)}
                    />
                    <span className="flex-1 truncate">{inv.instrument_name}</span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
                      {formatRupiah(investmentValues[inv.id] ?? 0)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {!tableReady && (
              <span className="mr-auto text-xs text-danger">Jalankan migration 0008 terlebih dahulu.</span>
            )}
            <Button type="submit" disabled={submitting || !tableReady}>
              {submitting ? "Menyimpan..." : "Simpan Rencana"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
