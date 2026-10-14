import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Source value for estimates the AI receptionist drafted from a phone call. */
export const AI_RECEPTIONIST_SOURCE = "ai_receptionist";

export function isAiGenerated(source?: string | null) {
  return source === AI_RECEPTIONIST_SOURCE;
}

/** "AI Generated" pill for drafts created by the AI receptionist (review before sending). */
export function AiGeneratedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-500/25 ring-inset dark:text-violet-300",
        className,
      )}
      title="Drafted by the AI receptionist from a phone call. Review before sending."
    >
      <Sparkles className="size-3" aria-hidden="true" />
      AI Generated
    </span>
  );
}
