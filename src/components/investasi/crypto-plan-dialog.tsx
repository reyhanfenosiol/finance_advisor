"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertCryptoPlanAction, type CryptoPlanInput } from "@/lib/actions/crypto-plan";
import type { CryptoAllocation, Investment } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const NO_LINK = "__none__";

function numOrNull(v: string) {
  return v.trim() === "" ? null : Number(v);
}

export function CryptoPlanDialog({
  open,
  onOpenChange,
  initial,
  cryptoInstruments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CryptoPlanInput;
  cryptoInstruments: Investment[];
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const totalPct = form.allocations.reduce((s, a) => s + (Number(a.target_pct) || 0), 0);
  const instrumentItems = [
    { value: NO_LINK, label: "— Belum ditautkan —" },
    ...cryptoInstruments.map((i) => ({ value: i.id, label: i.instrument_name })),
  ];

  function setField<K extends keyof CryptoPlanInput>(key: K, value: CryptoPlanInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setAllocation(index: number, patch: Partial<CryptoAllocation>) {
    setForm((f) => ({
      ...f,
      allocations: f.allocations.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(totalPct - 100) > 0.01) {
      toast.error(`Total alokasi target harus 100% (sekarang ${totalPct}%)`);
      return;
    }
    setSubmitting(true);
    try {
      await upsertCryptoPlanAction({
        ...form,
        allocations: form.allocations.map((a) => ({
          ...a,
          symbol: a.symbol.trim().toUpperCase(),
          coingecko_id: a.coingecko_id.trim().toLowerCase(),
        })),
      });
      toast.success("Rencana crypto disimpan");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan rencana");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atur Rencana Crypto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dca">DCA per Bulan (Rp)</Label>
              <Input
                id="dca"
                type="number"
                min={0}
                step="1000"
                value={form.monthly_dca_amount}
                onChange={(e) => setField("monthly_dca_amount", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Mulai DCA</Label>
              <Input
                id="start"
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horizon">Horizon (tahun)</Label>
              <Input
                id="horizon"
                type="number"
                min={1}
                max={50}
                value={form.horizon_years}
                onChange={(e) => setField("horizon_years", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxpct">Batas Porsi Crypto (%)</Label>
              <Input
                id="maxpct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.max_portfolio_pct}
                onChange={(e) => setField("max_portfolio_pct", Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rebal">Ambang Rebalancing (±%)</Label>
              <Input
                id="rebal"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.rebalance_threshold_pct}
                onChange={(e) => setField("rebalance_threshold_pct", Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Asumsi Return Tahunan untuk Simulasi (%)</div>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ["return_pessimistic", "Pesimis"],
                  ["return_moderate", "Moderat"],
                  ["return_optimistic", "Optimis"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    step="0.5"
                    value={form[key]}
                    onChange={(e) => setField(key, Number(e.target.value))}
                    required
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Return crypto tidak bisa diprediksi. Angka ini hanya asumsi untuk melihat rentang
              kemungkinan.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">
                Alokasi Target{" "}
                <span
                  className={
                    Math.abs(totalPct - 100) > 0.01 ? "text-danger" : "text-muted-foreground"
                  }
                >
                  (total {totalPct}%)
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setField("allocations", [
                    ...form.allocations,
                    { symbol: "", coingecko_id: "", target_pct: 0, investment_id: null, manual_price: null },
                  ])
                }
              >
                <Plus /> Tambah Koin
              </Button>
            </div>
            <div className="space-y-3">
              {form.allocations.map((a, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-[80px_1fr_80px_1.4fr_1fr_auto] sm:items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Simbol</Label>
                    <Input
                      value={a.symbol}
                      placeholder="BTC"
                      onChange={(e) => setAllocation(i, { symbol: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ID CoinGecko</Label>
                    <Input
                      value={a.coingecko_id}
                      placeholder="bitcoin"
                      onChange={(e) => setAllocation(i, { coingecko_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Target %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={a.target_pct}
                      onChange={(e) => setAllocation(i, { target_pct: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Instrumen Tertaut</Label>
                    <Select
                      items={instrumentItems}
                      value={a.investment_id ?? NO_LINK}
                      onValueChange={(v) =>
                        setAllocation(i, { investment_id: !v || v === NO_LINK ? null : String(v) })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {instrumentItems.map((it) => (
                          <SelectItem key={it.value} value={it.value}>
                            {it.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Harga Manual (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="opsional"
                      value={a.manual_price ?? ""}
                      onChange={(e) => setAllocation(i, { manual_price: numOrNull(e.target.value) })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus koin"
                    onClick={() =>
                      setField(
                        "allocations",
                        form.allocations.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Tautkan ke instrumen crypto di menu Input Investasi agar unit & modal terbaca. Harga
              manual dipakai bila harga live CoinGecko tidak tersedia.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Rencana"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
