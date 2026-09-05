"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDate } from "@/lib/format";
import type {
  Investment,
  InstrumentType,
  InvestmentOwnership,
  InvestmentTransaction,
  InvestmentValuation,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColGroup, ResizableHead, useColumnWidths } from "@/components/ui/resizable-table";
import { Badge } from "@/components/ui/badge";
import { InvestmentTransactionDialog, type EditingItem } from "@/components/investasi/investment-transaction-dialog";
import { ValuationDialog } from "@/components/investasi/valuation-dialog";
import { Pencil, Trash2, Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  createInvestmentTransactionAction,
  createValuationAction,
  deleteInvestmentTransactionAction,
  deleteValuationAction,
  updateInstrumentOwnershipAction,
  updateInstrumentTypeAction,
  updateInvestmentTransactionAction,
  updateValuationAction,
} from "@/lib/actions/investments";

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

type HistoryKind = "buy" | "sell" | "update_value";

type HistoryEntry = {
  id: string;
  investmentId: string;
  date: string;
  kind: HistoryKind;
  amount: number;
  editableTransaction: InvestmentTransaction | null;
  editableValuation: InvestmentValuation | null;
};

const HISTORY_COLUMN_ORDER = [
  "date",
  "instrument",
  "type",
  "action",
  "amount",
  "growthModal",
  "growthPrevious",
  "manage",
];
const DEFAULT_HISTORY_COLUMN_WIDTHS: Record<string, number> = {
  date: 120,
  instrument: 180,
  type: 110,
  action: 120,
  amount: 140,
  growthModal: 130,
  growthPrevious: 140,
  manage: 90,
};

export function InvestasiClient({
  initialInstruments,
  initialTransactions,
  initialValuations,
  userId,
}: {
  initialInstruments: Investment[];
  initialTransactions: InvestmentTransaction[];
  initialValuations: InvestmentValuation[];
  userId: string;
}) {
  const [instruments, setInstruments] = useState(initialInstruments);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [valuations, setValuations] = useState(initialValuations);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("all");
  const [filterAksi, setFilterAksi] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditingItem>(null);
  const [valuationTarget, setValuationTarget] = useState<Investment | null>(null);
  const { widths, startResize } = useColumnWidths(DEFAULT_HISTORY_COLUMN_WIDTHS);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("investasi-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investment_transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          setTransactions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as InvestmentTransaction;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as InvestmentTransaction;
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as InvestmentTransaction;
              return prev.filter((t) => t.id !== row.id);
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investment_valuations", filter: `user_id=eq.${userId}` },
        (payload) => {
          setValuations((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as InvestmentValuation;
              if (prev.some((v) => v.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as InvestmentValuation;
              return prev.filter((v) => v.id !== row.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function latestValuation(investmentId: string) {
    return valuations
      .filter((v) => v.investment_id === investmentId)
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
  }

  function modal(investmentId: string, asOfDate?: string) {
    return transactions
      .filter((t) => t.investment_id === investmentId && (asOfDate ? t.transaction_date <= asOfDate : true))
      .reduce((sum, t) => sum + (t.type === "buy" ? t.amount : -t.amount), 0);
  }

  // Valuations per instrument, sorted chronologically - used to find the
  // "previous entry" for the entry-over-entry growth figure.
  const valuationsByInstrument = useMemo(() => {
    const map = new Map<string, InvestmentValuation[]>();
    for (const v of valuations) {
      const list = map.get(v.investment_id) ?? [];
      list.push(v);
      map.set(v.investment_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.valuation_date.localeCompare(b.valuation_date) || a.id.localeCompare(b.id));
    }
    return map;
  }, [valuations]);

  function previousValuation(v: InvestmentValuation) {
    const list = valuationsByInstrument.get(v.investment_id) ?? [];
    const idx = list.findIndex((x) => x.id === v.id);
    return idx > 0 ? list[idx - 1] : null;
  }

  // Growth between the two most recent valuation checkpoints for an
  // instrument, shown on its card alongside growth-vs-modal.
  function growthVsPreviousEntry(investmentId: string): number | null {
    const list = valuationsByInstrument.get(investmentId) ?? [];
    if (list.length < 2) return null;
    const latest = list[list.length - 1];
    const prev = list[list.length - 2];
    if (prev.current_value <= 0) return null;
    return ((latest.current_value - prev.current_value) / prev.current_value) * 100;
  }

  const history = useMemo<HistoryEntry[]>(() => {
    const txEntries: HistoryEntry[] = transactions.map((t) => ({
      id: t.id,
      investmentId: t.investment_id,
      date: t.transaction_date,
      kind: t.type,
      amount: t.amount,
      editableTransaction: t,
      editableValuation: null,
    }));
    const valEntries: HistoryEntry[] = valuations.map((v) => ({
      id: v.id,
      investmentId: v.investment_id,
      date: v.valuation_date,
      kind: "update_value",
      amount: v.current_value,
      editableTransaction: null,
      editableValuation: v,
    }));
    return [...txEntries, ...valEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, valuations]);

  const filtered = useMemo(() => {
    return history
      .filter((h) => {
        const inst = instruments.find((i) => i.id === h.investmentId);
        return filterJenis === "all" ? true : inst?.instrument_type === filterJenis;
      })
      .filter((h) => (filterAksi === "all" ? true : h.kind === filterAksi))
      .filter((h) => {
        const inst = instruments.find((i) => i.id === h.investmentId);
        return search.trim() === ""
          ? true
          : (inst?.instrument_name ?? "").toLowerCase().includes(search.toLowerCase());
      });
  }, [history, instruments, search, filterJenis, filterAksi]);

  async function handleDeleteTransaction(id: string) {
    if (!confirm("Hapus transaksi investasi ini?")) return;
    try {
      await deleteInvestmentTransactionAction(id);
      toast.success("Transaksi dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus transaksi");
    }
  }

  async function handleDeleteValuation(id: string) {
    if (!confirm("Hapus entri nilai wajar ini?")) return;
    try {
      await deleteValuationAction(id);
      toast.success("Entri nilai dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus entri nilai");
    }
  }

  async function handleOwnershipChange(id: string, ownership: InvestmentOwnership) {
    setInstruments((prev) => prev.map((i) => (i.id === id ? { ...i, ownership } : i)));
    try {
      await updateInstrumentOwnershipAction(id, ownership);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah kategori aset");
    }
  }

  async function handleTypeChange(id: string, instrumentType: InstrumentType) {
    setInstruments((prev) => prev.map((i) => (i.id === id ? { ...i, instrument_type: instrumentType } : i)));
    try {
      await updateInstrumentTypeAction(id, instrumentType);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah jenis instrumen");
    }
  }

  // Hide instrument cards once their last transaction/valuation entry is
  // deleted, instead of leaving a stale Rp0 card behind.
  function hasEntries(investmentId: string) {
    return (
      transactions.some((t) => t.investment_id === investmentId) ||
      valuations.some((v) => v.investment_id === investmentId)
    );
  }

  const pribadiInstruments = instruments.filter((i) => i.ownership === "pribadi" && hasEntries(i.id));
  const keluargaInstruments = instruments.filter((i) => i.ownership === "keluarga" && hasEntries(i.id));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Transaksi Investasi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Riwayat setor, tarik, dan update nilai portofolio per instrumen
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah Transaksi Investasi
        </Button>
      </div>

      {instruments.length > 0 && (
        <div className="mb-6 space-y-6">
          {pribadiInstruments.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aset Pribadi
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pribadiInstruments.map((inst) => (
                  <InstrumentCard
                    key={inst.id}
                    instrument={inst}
                    currentValue={latestValuation(inst.id)?.current_value ?? modal(inst.id)}
                    investedAmount={modal(inst.id)}
                    growthVsPrevious={growthVsPreviousEntry(inst.id)}
                    onUpdateNilai={() => setValuationTarget(inst)}
                    onOwnershipChange={(o) => handleOwnershipChange(inst.id, o)}
                    onTypeChange={(t) => handleTypeChange(inst.id, t)}
                  />
                ))}
              </div>
            </div>
          )}
          {keluargaInstruments.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aset Keluarga
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {keluargaInstruments.map((inst) => (
                  <InstrumentCard
                    key={inst.id}
                    instrument={inst}
                    currentValue={latestValuation(inst.id)?.current_value ?? modal(inst.id)}
                    investedAmount={modal(inst.id)}
                    growthVsPrevious={growthVsPreviousEntry(inst.id)}
                    onUpdateNilai={() => setValuationTarget(inst)}
                    onOwnershipChange={(o) => handleOwnershipChange(inst.id, o)}
                    onTypeChange={(t) => handleTypeChange(inst.id, t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Cari instrumen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterJenis} onValueChange={(v) => v && setFilterJenis(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis</SelectItem>
            {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAksi} onValueChange={(v) => v && setFilterAksi(v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Aksi</SelectItem>
            <SelectItem value="buy">Beli/Setor</SelectItem>
            <SelectItem value="sell">Jual/Tarik</SelectItem>
            <SelectItem value="update_value">Update Nilai</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table className="table-fixed">
          <ColGroup columns={HISTORY_COLUMN_ORDER} widths={widths} />
          <TableHeader>
            <TableRow>
              <ResizableHead onResizeStart={startResize("date")}>Tanggal</ResizableHead>
              <ResizableHead onResizeStart={startResize("instrument")}>Instrumen</ResizableHead>
              <ResizableHead onResizeStart={startResize("type")}>Jenis</ResizableHead>
              <ResizableHead onResizeStart={startResize("action")}>Aksi</ResizableHead>
              <ResizableHead onResizeStart={startResize("amount")} className="text-right">
                Nominal / Nilai
              </ResizableHead>
              <ResizableHead onResizeStart={startResize("growthModal")} className="text-right">
                Growth vs Modal
              </ResizableHead>
              <ResizableHead onResizeStart={startResize("growthPrevious")} className="text-right">
                Growth vs Entri Lalu
              </ResizableHead>
              <ResizableHead onResizeStart={startResize("manage")}>Kelola</ResizableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Belum ada transaksi investasi.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((h) => {
              const inst = instruments.find((i) => i.id === h.investmentId);

              let growthVsModal: number | null = null;
              let growthVsPrevious: number | null = null;

              if (h.kind === "update_value") {
                const modalAsOf = modal(h.investmentId, h.date);
                if (modalAsOf > 0) {
                  growthVsModal = ((h.amount - modalAsOf) / modalAsOf) * 100;
                }
                const valuation = valuations.find((v) => v.id === h.id);
                const prev = valuation ? previousValuation(valuation) : null;
                if (prev && prev.current_value > 0) {
                  growthVsPrevious = ((h.amount - prev.current_value) / prev.current_value) * 100;
                }
              }

              return (
                <TableRow key={`${h.kind}-${h.id}`}>
                  <TableCell className="whitespace-nowrap font-[family-name:var(--font-mono)] text-sm">
                    {formatDate(h.date)}
                  </TableCell>
                  <TableCell>{inst?.instrument_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {inst ? INSTRUMENT_LABELS[inst.instrument_type] : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        h.kind === "buy"
                          ? "border-success/30 bg-success-bg text-success"
                          : h.kind === "sell"
                            ? "border-danger/30 bg-danger-bg text-danger"
                            : "border-warning/30 bg-warning-bg text-warning"
                      }
                    >
                      {h.kind === "buy" ? "Beli/Setor" : h.kind === "sell" ? "Jual/Tarik" : "Update Nilai"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-[family-name:var(--font-mono)] font-medium " +
                      (h.kind === "buy" ? "text-success" : h.kind === "sell" ? "text-danger" : "text-foreground")
                    }
                  >
                    {formatRupiah(h.amount)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-[family-name:var(--font-mono)] text-xs " +
                      (growthVsModal === null
                        ? "text-muted-foreground"
                        : growthVsModal >= 0
                          ? "text-success"
                          : "text-danger")
                    }
                  >
                    {growthVsModal === null
                      ? "—"
                      : `${growthVsModal >= 0 ? "+" : ""}${growthVsModal.toFixed(1)}%`}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-[family-name:var(--font-mono)] text-xs " +
                      (growthVsPrevious === null
                        ? "text-muted-foreground"
                        : growthVsPrevious >= 0
                          ? "text-success"
                          : "text-danger")
                    }
                  >
                    {growthVsPrevious === null
                      ? "—"
                      : `${growthVsPrevious >= 0 ? "+" : ""}${growthVsPrevious.toFixed(1)}%`}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          if (h.editableTransaction) {
                            setEditing({ kind: "transaction", data: h.editableTransaction });
                          } else if (h.editableValuation) {
                            setEditing({ kind: "valuation", data: h.editableValuation });
                          }
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger hover:text-danger"
                        onClick={() =>
                          h.kind === "update_value" ? handleDeleteValuation(h.id) : handleDeleteTransaction(h.id)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        {filtered.length} entri ditampilkan
      </div>

      <InvestmentTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instruments={instruments}
        editing={editing}
        onInstrumentCreated={(inst) => setInstruments((prev) => [...prev, inst])}
        onInstrumentTypeChange={handleTypeChange}
        onInstrumentOwnershipChange={handleOwnershipChange}
        onSubmit={async (input) => {
          try {
            if (editing?.kind === "transaction") {
              await updateInvestmentTransactionAction(editing.data.id, input);
              toast.success("Transaksi diperbarui");
            } else {
              await createInvestmentTransactionAction(input);
              toast.success("Transaksi ditambahkan");
            }
            setDialogOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal menyimpan transaksi");
          }
        }}
        onValuationSubmit={async (investmentId, currentValue, valuationDate) => {
          try {
            await createValuationAction(investmentId, currentValue, valuationDate);
            toast.success("Nilai wajar ditambahkan");
            setDialogOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal menyimpan nilai");
          }
        }}
        onValuationEdit={async (id, currentValue, valuationDate) => {
          try {
            await updateValuationAction(id, currentValue, valuationDate);
            toast.success("Nilai wajar diperbarui");
            setDialogOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal memperbarui nilai");
          }
        }}
      />

      <ValuationDialog
        open={!!valuationTarget}
        onOpenChange={(open) => !open && setValuationTarget(null)}
        instrument={valuationTarget}
      />
    </div>
  );
}

function InstrumentCard({
  instrument,
  currentValue,
  investedAmount,
  growthVsPrevious,
  onUpdateNilai,
  onOwnershipChange,
  onTypeChange,
}: {
  instrument: Investment;
  currentValue: number;
  investedAmount: number;
  growthVsPrevious: number | null;
  onUpdateNilai: () => void;
  onOwnershipChange: (ownership: InvestmentOwnership) => void;
  onTypeChange: (instrumentType: InstrumentType) => void;
}) {
  const returnPct = investedAmount > 0 ? ((currentValue - investedAmount) / investedAmount) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{instrument.instrument_name}</div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={onUpdateNilai}>
          <TrendingUp className="mr-1 h-3 w-3" />
          Update Nilai
        </Button>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Nilai saat ini</span>
        <span className="font-[family-name:var(--font-mono)] text-sm font-semibold">
          {formatRupiah(currentValue)}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Modal disetor</span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
          {formatRupiah(investedAmount)}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Growth vs Modal</span>
        <span
          className={
            "text-xs font-medium " +
            (investedAmount > 0 ? (returnPct >= 0 ? "text-success" : "text-danger") : "text-muted-foreground")
          }
        >
          {investedAmount > 0 ? `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%` : "—"}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Growth vs Entri Lalu</span>
        <span
          className={
            "text-xs font-medium " +
            (growthVsPrevious === null
              ? "text-muted-foreground"
              : growthVsPrevious >= 0
                ? "text-success"
                : "text-danger")
          }
        >
          {growthVsPrevious === null ? "—" : `${growthVsPrevious >= 0 ? "+" : ""}${growthVsPrevious.toFixed(1)}%`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Select
          value={instrument.instrument_type}
          onValueChange={(v) => v && onTypeChange(v as InstrumentType)}
        >
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={instrument.ownership} onValueChange={(v) => v && onOwnershipChange(v as InvestmentOwnership)}>
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pribadi">Aset Pribadi</SelectItem>
            <SelectItem value="keluarga">Aset Keluarga</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
