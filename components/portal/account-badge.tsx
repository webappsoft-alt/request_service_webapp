import { cn } from "@/lib/utils";
import type { CustomerAccount } from "@/lib/data/lead-origins";

/** "Has account" (registered customer) / "Guest" (website lead without one). Nothing for "none". */
export function AccountBadge({ account, className }: { account?: CustomerAccount | null; className?: string }) {
  if (account !== "registered" && account !== "guest") return null;
  const registered = account === "registered";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-medium",
        registered
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        className,
      )}
      title={
        registered
          ? "Has a customer account on Request Services"
          : "Website quote or chat — no customer account"
      }
    >
      {registered ? "Has account" : "Guest"}
    </span>
  );
}
