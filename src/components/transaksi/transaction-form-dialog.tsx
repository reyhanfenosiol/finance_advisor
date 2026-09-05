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
import { createCategoryAction } from "@/lib/actions/categories";
import type { Category, Transaction, TransactionType } from "@/types";
import type { TransactionInput } from "@/lib/actions/transactions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  categories,
  editing,
  onSubmit,
  onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editing: Transaction | null;
  onSubmit: (input: TransactionInput) => Promise<void>;
  onCategoryCreated: (category: Category) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <TransactionForm
            key={editing?.id ?? "new"}
            categories={categories}
            editing={editing}
            onSubmit={onSubmit}
            onCategoryCreated={onCategoryCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  categories,
  editing,
  onSubmit,
  onCategoryCreated,
}: {
  categories: Category[];
  editing: Transaction | null;
  onSubmit: (input: TransactionInput) => Promise<void>;
  onCategoryCreated: (category: Category) => void;
}) {
  const [type, setType] = useState<TransactionType>(editing?.type ?? "expense");
  const [date, setDate] = useState(editing?.transaction_date ?? todayISO());
  const [category, setCategory] = useState(editing?.category ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions = categories.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalCategory = category;

      if (newCategoryMode && newCategoryName.trim()) {
        const created = await createCategoryAction(newCategoryName.trim(), type);
        onCategoryCreated(created);
        finalCategory = created.name;
      }

      if (!finalCategory || !amount) return;

      await onSubmit({
        type,
        category: finalCategory,
        amount: Number(amount),
        description: description.trim() || null,
        transaction_date: date,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit Transaksi" : "Tambah Transaksi"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setType("income");
              setCategory("");
            }}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              type === "income"
                ? "border-success/30 bg-success-bg text-success"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            ↓ Pemasukan
          </button>
          <button
            type="button"
            onClick={() => {
              setType("expense");
              setCategory("");
            }}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              type === "expense"
                ? "border-danger/30 bg-danger-bg text-danger"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            ↑ Pengeluaran
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Tanggal</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Kategori</Label>
          {!newCategoryMode ? (
            <Select
              value={category}
              onValueChange={(v) => {
                if (v === "__new__") {
                  setNewCategoryMode(true);
                } else if (v) {
                  setCategory(v);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ Tambah kategori baru</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Nama kategori baru"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => setNewCategoryMode(false)}>
                Batal
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Jumlah (Rp)</Label>
          <Input
            id="amount"
            type="number"
            min={1}
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Deskripsi (opsional)</Label>
          <Input
            id="description"
            placeholder="mis. Makan siang tim"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={submitting || (!newCategoryMode && !category) || !amount}>
            {submitting ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Transaksi"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
