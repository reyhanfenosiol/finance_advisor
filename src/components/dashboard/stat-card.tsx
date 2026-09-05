import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5",
        tone === "success" && "border-success/20 bg-success-bg/50",
        tone === "danger" && "border-danger/20 bg-danger-bg/50"
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-[family-name:var(--font-mono)] text-2xl font-semibold",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger"
        )}
      >
        {value}
      </div>
    </div>
  );
}
