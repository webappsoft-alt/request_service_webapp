import Link from "next/link";
import { History, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const AI_RECEPTIONIST_PATH = "/pro/dashboard/ai-receptionist";

const TABS = [
  {
    id: "settings",
    label: "Settings",
    href: AI_RECEPTIONIST_PATH,
    icon: Settings2,
  },
  {
    id: "calls",
    label: "Call history",
    href: `${AI_RECEPTIONIST_PATH}/calls`,
    icon: History,
  },
] as const;

/** AI Receptionist sub-navigation: Settings (configuration only) and Call history. */
export function AiReceptionistTabs({
  active,
}: {
  active: "settings" | "calls";
}) {
  return (
    <nav
      aria-label="AI Receptionist"
      className="rounded-xl border border-border-soft bg-card px-2 pt-1"
    >
      <ul className="flex items-center gap-1">
        {TABS.map((tab) => {
          const current = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  current
                    ? "border-[#003F7D] font-semibold text-[#003F7D] dark:border-primary dark:text-primary"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
