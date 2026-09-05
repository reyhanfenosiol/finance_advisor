"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDate } from "@/lib/format";
import type { Category, Transaction } from "@/types";
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from "@/lib/actions/transactions";
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
import { TransactionFormDialog } from "@/components/transaksi/transaction-form-dialog";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortKey = "transaction_date" | "type" | "category" | "description" | "amount";
type SortDir = "asc" | "desc";

const COLUMN_ORDER = ["date", "type", "category", "description", "amount", "actions"];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  date: 130,
  type: 120,
  category: 150,
  description: 240,
  amount: 150,
  actions: 90,
};

function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  onResizeStart,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <ResizableHead onResizeStart={onResizeStart} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-foreground",
          active && "text-foreground font-medium"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </ResizableHead>
  );
}

export function TransaksiClient({
  initialTransactions,
  initialCategories,
  userId,
}: {
  initialTransactions: Transaction[];
  initialCategories: Category[];
  userId: string;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("transaction_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { widths, startResize } = useColumnWidths(DEFAULT_COLUMN_WIDTHS);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          setTransactions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Transaction;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Transaction;
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Transaction;
              return prev.filter((t) => t.id !== row.id);
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

  const filtered = useMemo(() => {
    const result = transactions
      .filter((t) => (filterType === "all" ? true : t.type === filterType))
      .filter((t) => (filterCategory === "all" ? true : t.category === filterCategory))
      .filter((t) =>
        search.trim() === ""
          ? true
          : (t.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase())
      );

    const dirMul = sortDir === "asc" ? 1 : -1;
    return result.sort((a, b) => {
      switch (sortKey) {
        case "amount":
          return (a.amount - b.amount) * dirMul;
        case "description":
          return (a.description ?? "").localeCompare(b.description ?? "") * dirMul;
        case "type":
          return a.type.localeCompare(b.type) * dirMul;
        case "category":
          return a.category.localeCompare(b.category) * dirMul;
        case "transaction_date":
        default:
          return a.transaction_date.localeCompare(b.transaction_date) * dirMul;
      }
    });
  }, [transactions, search, filterType, filterCategory, sortKey, sortDir]);

  const total = filtered.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0
  );

  async function handleDelete(id: string) {
    if (!confirm("Hapus transaksi ini?")) return;
    try {
      await deleteTransactionAction(id);
      toast.success("Transaksi dihapus");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus transaksi");
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Transaksi Cashflow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seluruh catatan pemasukan dan pengeluaran harian Anda
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah Transaksi
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Cari deskripsi atau kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="income">Pemasukan</SelectItem>
            <SelectItem value="expense">Pengeluaran</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={(v) => v && setFilterCategory(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {[...new Set(categories.map((c) => c.name))].map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table className="table-fixed">
          <ColGroup columns={COLUMN_ORDER} widths={widths} />
          <TableHeader>
            <TableRow>
              <SortableHead
                label="Tanggal"
                sortKey="transaction_date"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                onResizeStart={startResize("date")}
              />
              <SortableHead
                label="Tipe"
                sortKey="type"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                onResizeStart={startResize("type")}
              />
              <SortableHead
                label="Kategori"
                sortKey="category"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                onResizeStart={startResize("category")}
              />
              <SortableHead
                label="Deskripsi"
                sortKey="description"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                onResizeStart={startResize("description")}
              />
              <SortableHead
                label="Jumlah"
                sortKey="amount"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                onResizeStart={startResize("amount")}
                className="text-right"
              />
              <ResizableHead onResizeStart={startResize("actions")}>Aksi</ResizableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Belum ada transaksi.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap font-[family-name:var(--font-mono)] text-sm">
                  {formatDate(t.transaction_date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      t.type === "income"
                        ? "border-success/30 bg-success-bg text-success"
                        : "border-danger/30 bg-danger-bg text-danger"
                    }
                  >
                    {t.type === "income" ? "Pemasukan" : "Pengeluaran"}
                  </Badge>
                </TableCell>
                <TableCell>{t.category}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.description || "—"}
                </TableCell>
                <TableCell
                  className={
                    "text-right font-[family-name:var(--font-mono)] font-medium " +
                    (t.type === "income" ? "text-success" : "text-danger")
                  }
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatRupiah(t.amount)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:text-danger"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex justify-between text-sm text-muted-foreground">
        <span>{filtered.length} transaksi ditampilkan</span>
        <span className="font-[family-name:var(--font-mono)] font-medium text-foreground">
          Saldo: {formatRupiah(total)}
        </span>
      </div>

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        editing={editing}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
        onSubmit={async (input) => {
          try {
            if (editing) {
              await updateTransactionAction(editing.id, input);
              toast.success("Transaksi diperbarui");
            } else {
              await createTransactionAction(input);
              toast.success("Transaksi ditambahkan");
            }
            setDialogOpen(false);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal menyimpan transaksi");
          }
        }}
      />
    </div>
  );
}
