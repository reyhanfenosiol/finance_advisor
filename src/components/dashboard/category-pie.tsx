import { formatRupiah } from "@/lib/format";
import { renderOutsidePieLabel } from "@/components/dashboard/pie-label";
import { CHART_COLORS } from "@/components/dashboard/chart-colors";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function CategoryPie({
  data,
  height = "h-64",
  emptyMessage = "Belum ada data.",
}: {
  data: { name: string; value: number }[];
  height?: string;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <div className={`flex ${height} items-center justify-center text-sm text-muted-foreground`}>
        {emptyMessage}
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={62}
              paddingAngle={2}
              label={renderOutsidePieLabel}
              labelLine={{ stroke: "var(--border)", strokeWidth: 1 }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatRupiah(Number(value)), name]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 overflow-hidden text-xs text-muted-foreground">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="truncate" title={d.name}>
              {d.name}
            </span>
            <span className="ml-auto shrink-0 tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
