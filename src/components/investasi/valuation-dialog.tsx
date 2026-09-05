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
import { createValuationAction } from "@/lib/actions/investments";
import type { Investment } from "@/types";
import { toast } from "sonner";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function ValuationDialog({
  open,
  onOpenChange,
  instrument,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Investment | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ValuationForm
            key={instrument?.id ?? "none"}
            instrument={instrument}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ValuationForm({
  instrument,
  onSaved,
}: {
  instrument: Investment | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instrument || !value) return;
    setSubmitting(true);
    try {
      await createValuationAction(instrument.id, Number(value), date);
      toast.success("Nilai wajar diperbarui");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan nilai");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update Nilai Wajar — {instrument?.instrument_name}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="val-date">Tanggal Valuasi</Label>
          <Input id="val-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="val-amount">Nilai Wajar Saat Ini (Rp)</Label>
          <Input
            id="val-amount"
            type="number"
            min={0}
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !value}>
            {submitting ? "Menyimpan..." : "Simpan Nilai"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
