"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import type { Transaction } from "@/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { AiAdvisorWidget } from "@/components/dashboard/ai-advisor-widget";
import { ChatWidget } from "@/components/chat/chat-widget";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CategoryPie } from "@/components/dashboard/category-pie";

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

const MONTH_OPTIONS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export function DashboardCashflowClient({
  transactions: initial,
  userId,
}: {
  transactions: Transaction[];
  userId: string;
}) {
  const [transactions, setTransactions] = useState(initial);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-cashflow-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          setTransactions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Transaction;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [...prev, row].sort((a, b) =>
                a.transaction_date.localeCompare(b.transaction_date)
              );
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

  const dataMonthKeys = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.transaction_date)));
    return [...set].sort().reverse();
  }, [transactions]);

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const monthKeys = useMemo(() => {
    const set = new Set(dataMonthKeys);
    set.add(currentMonth);
    return [...set].sort().reverse();
  }, [dataMonthKeys, currentMonth]);

  const years = useMemo(() => {
    const set = new Set(monthKeys.map((k) => k.slice(0, 4)));
    return [...set].sort().reverse();
  }, [monthKeys]);

  // Default to the most recent period that actually has transactions,
  // rather than the current calendar month (which may be empty).
  const defaultKey = dataMonthKeys[0] ?? currentMonth;
  const defaultYear = defaultKey.slice(0, 4);
  const defaultMonthNum = defaultKey.slice(5, 7);

  const [filterMode, setFilterMode] = useState<"year" | "year-month">("year-month");
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string | null>(null);

  const effectiveYear = selectedYear && years.includes(selectedYear) ? selectedYear : defaultYear;
  const effectiveMonthNum =
    selectedMonthNum && MONTH_OPTIONS.some((m) => m.value === selectedMonthNum)
      ? selectedMonthNum
      : defaultMonthNum;
  const effectiveMonth = `${effectiveYear}-${effectiveMonthNum}`;

  const periodTx = useMemo(
    () =>
      transactions.filter((t) =>
        filterMode === "year"
          ? t.transaction_date.slice(0, 4) === effectiveYear
          : monthKey(t.transaction_date) === effectiveMonth
      ),
    [transactions, filterMode, effectiveYear, effectiveMonth]
  );

  const totalIncome = periodTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = periodTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const saldo = totalIncome - totalExpense;

  const trendData = useMemo(() => {
    if (filterMode === "year") {
      const byMonth = new Map<string, { date: string; masuk: number; keluar: number }>();
      for (const t of periodTx) {
        const m = t.transaction_date.slice(5, 7);
        const entry = byMonth.get(m) ?? { date: m, masuk: 0, keluar: 0 };
        if (t.type === "income") entry.masuk += t.amount;
        else entry.keluar += t.amount;
        byMonth.set(m, entry);
      }
      return [...byMonth.values()]
        .map((e) => ({ ...e, date: MONTH_OPTIONS.find((m) => m.value === e.date)?.label.slice(0, 3) ?? e.date }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    const byDay = new Map<string, { date: string; masuk: number; keluar: number }>();
    for (const t of periodTx) {
      const day = t.transaction_date.slice(8, 10);
      const entry = byDay.get(day) ?? { date: day, masuk: 0, keluar: 0 };
      if (t.type === "income") entry.masuk += t.amount;
      else entry.keluar += t.amount;
      byDay.set(day, entry);
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [periodTx, filterMode]);

  function topCategories(type: "income" | "expense") {
    const byCat = new Map<string, number>();
    for (const t of periodTx.filter((t) => t.type === type)) {
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    }
    return [...byCat.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  const topExpenseCategories = topCategories("expense");
  const topIncomeCategories = topCategories("income");

  const top5Expenses = [...periodTx]
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const periodLabel = filterMode === "year" ? "tahun ini" : "bulan ini";
  const topExpenseCategory = topExpenseCategories[0];
  const insight = topExpenseCategory
    ? `Kategori pengeluaran terbesar ${periodLabel} adalah "${topExpenseCategory.name}" senilai ${formatRupiah(
        topExpenseCategory.value
      )}. Saldo bersih Anda saat ini ${formatRupiah(saldo)}.`
    : `Belum ada cukup data transaksi ${periodLabel} untuk dianalisis. Tambahkan transaksi untuk mendapatkan insight.`;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">
            Dashboard Cashflow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ringkasan pemasukan & pengeluaran bulan berjalan
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterMode} onValueChange={(v) => v && setFilterMode(v as "year" | "year-month")}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Tahun saja</SelectItem>
              <SelectItem value="year-month">Tahun + Bulan</SelectItem>
            </SelectContent>
          </Select>
          {filterMode === "year-month" && (
            <Select value={effectiveMonthNum} onValueChange={(v) => v && setSelectedMonthNum(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={effectiveYear} onValueChange={(v) => v && setSelectedYear(v)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatRupiah(totalIncome)} tone="success" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(totalExpense)} tone="danger" />
        <StatCard label="Saldo Bersih" value={formatRupiah(saldo)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 text-sm font-medium">
            {filterMode === "year" ? "Tren Cashflow Bulanan" : "Tren Cashflow Harian"}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                />
                <Tooltip
                  formatter={(value) => formatRupiah(Number(value))}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="masuk"
                  name="Pemasukan"
                  stroke="var(--success)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="keluar"
                  name="Pengeluaran"
                  stroke="var(--danger)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <AiAdvisorWidget
          title="Cashflow Advisor"
          insight={insight}
          onOpenChat={() => setChatOpen(true)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Top Kategori Pengeluaran</div>
          <CategoryPie data={topExpenseCategories} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Top Kategori Pemasukan</div>
          <CategoryPie data={topIncomeCategories} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 text-sm font-medium">Top 5 Pengeluaran Terbesar</div>
          <div className="space-y-2.5">
            {top5Expenses.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada pengeluaran {periodLabel}.</p>
            )}
            {top5Expenses.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.description || t.category}</div>
                  <div className="text-xs text-muted-foreground">{t.category}</div>
                </div>
                <div className="font-[family-name:var(--font-mono)] font-medium text-danger">
                  {formatRupiah(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ChatWidget advisorType="cashflow" open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
