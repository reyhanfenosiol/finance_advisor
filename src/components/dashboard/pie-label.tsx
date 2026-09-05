import type { PieLabelRenderProps } from "recharts";

const PIE_LABEL_RADIAN = Math.PI / 180;

export function renderOutsidePieLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = props.midAngle ?? 0;
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = props.percent ?? 0;
  const name = String(props.name ?? "");
  const radius = outerRadius + 14;
  const x = cx + radius * Math.cos(-midAngle * PIE_LABEL_RADIAN);
  const y = cy + radius * Math.sin(-midAngle * PIE_LABEL_RADIAN);
  const label = `${name} ${(percent * 100).toFixed(0)}%`;

  return (
    <text
      x={x}
      y={y}
      fill="var(--muted-foreground)"
      fontSize={10}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {label.length > 22 ? `${label.slice(0, 20)}…` : label}
    </text>
  );
}
