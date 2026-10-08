import type { TechChatThread } from "@/lib/api/technician-chat-client";
import { cn } from "@/lib/utils";

/** Office-side tag: is this field chat with an employee or an outside contractor? */
export function ParticipantBadge({
  thread,
  className,
}: {
  thread: Pick<TechChatThread, "participantType">;
  className?: string;
}) {
  const contractor = thread.participantType === "contractor";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-4",
        contractor ? "bg-[#e7f5f1] text-[#0f7b68]" : "bg-[#eef3f9] text-[#003f7d]",
        className,
      )}
    >
      {contractor ? "Contractor" : "Technician"}
    </span>
  );
}
