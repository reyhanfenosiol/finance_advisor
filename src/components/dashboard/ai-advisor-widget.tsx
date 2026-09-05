import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function AiAdvisorWidget({
  title,
  insight,
  onOpenChat,
}: {
  title: string;
  insight: string;
  onOpenChat: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary p-5 text-primary-foreground">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-warning" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-primary-foreground/85">{insight}</p>
      <Button size="sm" variant="secondary" className="mt-4" onClick={onOpenChat}>
        Tanya AI Advisor
      </Button>
    </div>
  );
}
