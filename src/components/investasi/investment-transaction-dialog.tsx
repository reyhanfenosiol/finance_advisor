"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createInstrumentAction } from "@/lib/actions/investments";
import type {
  Investment,
  InstrumentType,
  InvestmentOwnership,
  InvestmentTransaction,
  InvestmentValuation,
} from "@/types";
import type { InvestmentTransactionInput } from "@/lib/actions/investments";

type ActionMode = "buy" | "sell" | "update_value";

export type EditingItem =
  | { kind: "transaction"; data: InvestmentTransaction }
  | { kind: "valuation"; data: InvestmentValuation }
  | null;

const INSTRUMENT_TYPES: { value: InstrumentType; label: string }[] = [
  { value: "saham", label: "Saham" },
  { value: "reksadana", label: "Reksadana" },
  { value: "obligasi", label: "Obligasi" },
  { value: "emas", label: "Emas" },
  { value: "crypto", label: "Crypto" },
  { value: "deposito", label: "Deposito" },
  { value: "tabungan", label: "Tabungan" },
  { value: "p2p_lending", label: "P2P Lending" },
  { value: "properti", label: "Properti" },
  { value: "lainnya", label: "Lainnya" },
];

const OWNERSHIP_OPTIONS: { value: InvestmentOwnership; label: string }[] = [
  { value: "pribadi", label: "Aset Pribadi" },
  { value: "keluarga", label: "Aset Keluarga" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function InvestmentTransactionDialog({
  open,
  onOpenChange,
  instruments,
  editing,
  onSubmit,
  onValuationSubmit,
  onValuationEdit,
  onInstrumentCreated,
  onInstrumentTypeChange,
  onInstrumentOwnershipChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruments: Investment[];
  editing: EditingItem;
  onSubmit: (input: InvestmentTransactionInput) => Promise<void>;
  onValuationSubmit: (investmentId: string, currentValue: number, valuationDate: string) => Promise<void>;
  onValuationEdit: (id: string, currentValue: number, valuationDate: string) => Promise<void>;
  onInstrumentCreated: (investment: Investment) => void;
  onInstrumentTypeChange: (instrumentId: string, instrumentType: InstrumentType) => void;
  onInstrumentOwnershipChange: (instrumentId: string, ownership: InvestmentOwnership) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <InvestmentTransactionForm
            key={editing ? `${editing.kind}-${editing.data.id}` : "new"}
            instruments={instruments}
            editing={editing}
            onSubmit={onSubmit}
            onValuationSubmit={onValuationSubmit}
            onValuationEdit={onValuationEdit}
            onInstrumentCreated={onInstrumentCreated}
            onInstrumentTypeChange={onInstrumentTypeChange}
            onInstrumentOwnershipChange={onInstrumentOwnershipChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvestmentTransactionForm({
  instruments,
  editing,
  onSubmit,
  onValuationSubmit,
  onValuationEdit,
  onInstrumentCreated,
  onInstrumentTypeChange,
  onInstrumentOwnershipChange,
}: {
  instruments: Investment[];
  editing: EditingItem;
  onSubmit: (input: InvestmentTransactionInput) => Promise<void>;
  onValuationSubmit: (investmentId: string, currentValue: number, valuationDate: string) => Promise<void>;
  onValuationEdit: (id: string, currentValue: number, valuationDate: string) => Promise<void>;
  onInstrumentCreated: (investment: Investment) => void;
  onInstrumentTypeChange: (instrumentId: string, instrumentType: InstrumentType) => void;
  onInstrumentOwnershipChange: (instrumentId: string, ownership: InvestmentOwnership) => void;
}) {
  const [investmentId, setInvestmentId] = useState(editing?.data.investment_id ?? "");
  const [mode, setMode] = useState<ActionMode>(
    editing?.kind === "valuation" ? "update_value" : (editing?.data.type ?? "buy")
  );
  const [amount, setAmount] = useState(
    editing ? String(editing.kind === "valuation" ? editing.data.current_value : editing.data.amount) : ""
  );
  const [units, setUnits] = useState(
    editing?.kind === "transaction" && editing.data.units != null ? String(editing.data.units) : ""
  );
  const [pricePerUnit, setPricePerUnit] = useState(
    editing?.kind === "transaction" && editing.data.price_per_unit != null
      ? String(editing.data.price_per_unit)
      : ""
  );
  const [date, setDate] = useState(
    editing ? (editing.kind === "valuation" ? editing.data.valuation_date : editing.data.transaction_date) : todayISO()
  );
  const [newInstrumentMode, setNewInstrumentMode] = useState(false);
  const [newInstrumentName, setNewInstrumentName] = useState("");
  const [newInstrumentType, setNewInstrumentType] = useState<InstrumentType>("saham");
  const [newInstrumentOwnership, setNewInstrumentOwnership] = useState<InvestmentOwnership>("pribadi");
  const [submitting, setSubmitting] = useState(false);

  const selectedInstrument = instruments.find((i) => i.id === investmentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalInvestmentId = investmentId;

      if (newInstrumentMode && newInstrumentName.trim()) {
        const created = await createInstrumentAction(
          newInstrumentName.trim(),
          newInstrumentType,
          newInstrumentOwnership
        );
        onInstrumentCreated(created);
        finalInvestmentId = created.id;
      }

      if (!finalInvestmentId || !amount) return;

      if (mode === "update_value") {
        if (editing?.kind === "valuation") {
          await onValuationEdit(editing.data.id, Number(amount), date);
        } else {
          await onValuationSubmit(finalInvestmentId, Number(amount), date);
        }
      } else {
        await onSubmit({
          investment_id: finalInvestmentId,
          type: mode,
          amount: Number(amount),
          units: units ? Number(units) : null,
          price_per_unit: pricePerUnit ? Number(pricePerUnit) : null,
          transaction_date: date,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Entri Investasi" : "Tambah Transaksi Investasi"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setMode("buy")}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs font-medium transition-colors sm:text-sm",
              mode === "buy"
                ? "border-success/30 bg-success-bg text-success"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Beli / Setor
          </button>
          <button
            type="button"
            onClick={() => setMode("sell")}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs font-medium transition-colors sm:text-sm",
              mode === "sell"
                ? "border-danger/30 bg-danger-bg text-danger"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Jual / Tarik
          </button>
          <button
            type="button"
            onClick={() => setMode("update_value")}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs font-medium transition-colors sm:text-sm",
              mode === "update_value"
                ? "border-warning/30 bg-warning-bg text-warning"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Update Nilai
          </button>
        </div>

        <div className="space-y-2">
          <Label>Instrumen</Label>
          {!newInstrumentMode ? (
            <Select
              value={investmentId}
              onValueChange={(v) => {
                if (v === "__new__") setNewInstrumentMode(true);
                else if (v) setInvestmentId(v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih instrumen" />
              </SelectTrigger>
              <SelectContent>
                {instruments.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.instrument_name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ Tambah instrumen baru</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Input
                autoFocus
                placeholder="Nama instrumen, mis. BBCA"
                value={newInstrumentName}
                onChange={(e) => setNewInstrumentName(e.target.value)}
              />
              <Select value={newInstrumentType} onValueChange={(v) => setNewInstrumentType(v as InstrumentType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newInstrumentOwnership}
                onValueChange={(v) => setNewInstrumentOwnership(v as InvestmentOwnership)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setNewInstrumentMode(false)}>
                Batal
              </Button>
            </div>
          )}
        </div>

        {!newInstrumentMode && selectedInstrument && (
          <div className="space-y-2">
            <Label>Jenis & Kategori Instrumen</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={selectedInstrument.instrument_type}
                onValueChange={(v) => v && onInstrumentTypeChange(selectedInstrument.id, v as InstrumentType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedInstrument.ownership}
                onValueChange={(v) => v && onInstrumentOwnershipChange(selectedInstrument.id, v as InvestmentOwnership)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="inv-date">Tanggal</Label>
          <Input id="inv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inv-amount">
            {mode === "update_value" ? "Nilai Wajar Saat Ini (Rp)" : "Nominal (Rp)"}
          </Label>
          <Input
            id="inv-amount"
            type="number"
            min={mode === "update_value" ? 0 : 1}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {mode !== "update_value" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-units">Unit/Lot (opsional)</Label>
              <Input
                id="inv-units"
                type="number"
                step="any"
                placeholder="0"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-price">Harga/Unit (opsional)</Label>
              <Input
                id="inv-price"
                type="number"
                step="any"
                placeholder="0"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="submit" disabled={submitting || (!newInstrumentMode && !investmentId) || !amount}>
            {submitting ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Transaksi"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
