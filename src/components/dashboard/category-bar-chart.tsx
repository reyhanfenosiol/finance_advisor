"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import { CHART_COLORS } from "@/components/dashboard/chart-colors";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "@/types";

export function CategoryBarChart({
  data,
  items,
  height = "h-64",
  emptyMessage = "Belum ada data.",
}: {
  data: { name: string; value: number }[];
  items: Transaction[];
  height?: string;
  emptyMessage?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className={`flex ${height} items-center justify-center text-sm text-muted-foreground`}>
        {emptyMessage}
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = [...data]
    .sort((a, b) => b.value - a.value)
    .map((d) => ({ ...d, pct: total > 0 ? Math.round((d.value / total) * 100) : 0 }));

  const selectedItems = selected
    ? [...items.filter((t) => t.category === selected)].sort((a, b) =>
        b.transaction_date.localeCompare(a.transaction_date)
      )
    : [];

  return (
    <div>
      <div className={height} style={{ minHeight: chartData.length * 34 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
            barCategoryGap="25%"
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
            />
            <Tooltip
              formatter={(value, _name, entry) => [
                `${formatRupiah(Number(value))} (${entry.payload.pct}%)`,
                entry.payload.name,
              ]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              cursor="pointer"
              onClick={(entry) =>
                setSelected((prev) => (prev === entry.name ? null : (entry.name as string)))
              }
              label={(props) => {
                const { x, y, width, height, index } = props as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  index: number;
                };
                const pct = chartData[index]?.pct ?? 0;
                return (
                  <text
                    x={x + width + 8}
                    y={y + height / 2}
                    dy={4}
                    fontSize={11}
                    fill="var(--foreground)"
                  >
                    {pct}%
                  </text>
                );
              }}
            >
              {chartData.map((d, i) => (
                <Cell
                  key={d.name}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  opacity={selected && selected !== d.name ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <div className="mt-3 rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium">{selected}</span>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Tutup
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-normal">Tanggal</th>
                  <th className="px-3 py-1.5 font-normal">Deskripsi</th>
                  <th className="px-3 py-1.5 text-right font-normal">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground">
                      Tidak ada item.
                    </td>
                  </tr>
                )}
                {selectedItems.map((t) => (
                  <tr key={t.id} className="border-t border-border/60">
                    <td className="px-3 py-1.5 text-muted-foreground">{t.transaction_date}</td>
                    <td className="px-3 py-1.5">{t.description || "-"}</td>
                    <td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)]">
                      {formatRupiah(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
