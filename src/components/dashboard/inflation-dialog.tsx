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
import { upsertInflationAction } from "@/lib/actions/inflation";
import { toast } from "sonner";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function InflationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setSubmitting(true);
    try {
      await upsertInflationAction(period, Number(value));
      toast.success("Data inflasi disimpan");
      onOpenChange(false);
      setValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data inflasi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Input Data Inflasi Manual</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sumber utama data inflasi adalah BPS Web API. Gunakan form ini sebagai fallback jika API
          tidak tersedia.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period">Periode (Bulan)</Label>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inflation-value">Inflasi YoY (%)</Label>
            <Input
              id="inflation-value"
              type="number"
              step="0.01"
              placeholder="mis. 2.9"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !value}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
