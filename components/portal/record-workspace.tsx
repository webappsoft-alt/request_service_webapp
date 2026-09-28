"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Paperclip,
  Receipt,
  ScrollText,
  Settings2,
  Share2,
  Shield,
  StickyNote,
  UserRound,
  Wrench,
} from "lucide-react";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecordTab = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

const DEFAULT_TAB_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  summary: LayoutDashboard,
  profile: LayoutDashboard,
  details: LayoutDashboard,
  customer: UserRound,
  visit: ClipboardList,
  materials: Wrench,
  payments: CreditCard,
  attachments: Paperclip,
  photos: ImageIcon,
  logs: ScrollText,
  notes: StickyNote,
  settings: Settings2,
  share: Share2,
  estimates: FileText,
  jobs: Briefcase,
  schedule: CalendarDays,
  tasks: ClipboardList,
  reminders: Bell,
  messages: MessageSquare,
  invoice: Receipt,
  linked: Link2,
  change_orders: FileText,
  completion: ClipboardList,
  availability: CalendarDays,
  pay: CreditCard,
  compliance: Shield,
  account: CreditCard,
};

function resolveIcon(
  tab: RecordTab,
): ComponentType<{ className?: string }> | null {
  if (tab.icon) return tab.icon;
  return DEFAULT_TAB_ICONS[tab.id] ?? FileText;
}

/**
 * Simpro-style record chrome.
 * Main tabs sit on a grey track. Subnav (filters / actions) is always on white
 * so it never blends with the folder tab row.
 */
export function RecordWorkspace({
  href,
  label,
  kind,
  tabs,
  subnavTabs = [],
  subnav,
  actions,
  badge,
  notice,
  children,
}: {
  href: string;
  label: string;
  kind: string;
  tabs: RecordTab[];
  /** Tab ids that show a nested filter/action bar under the folder tab. */
  subnavTabs?: string[];
  /** Nested filters / actions for tabs in `subnavTabs`. */
  subnav?: (tab: string) => ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  notice?: ReactNode;
  children: (tab: string) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openRecord } = useOpenRecords();
  const tab = searchParams.get("tab") ?? tabs[0]?.id ?? "profile";
  const hasSubnav = subnavTabs.includes(tab);
  const subnavNode = hasSubnav && subnav ? subnav(tab) : null;

  useEffect(() => {
    openRecord({ href, label, kind });
  }, [href, kind, label, openRecord]);

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === tabs[0]?.id) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="bg-card">
      <div className="flex flex-col gap-2 border-b border-border-soft px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {label}
          </h1>
          {badge}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {/* Main folder tabs — grey track only */}
      <div className="bg-[#e8ecf1] px-3 pt-2 sm:px-4">
        <div
          className="flex flex-wrap items-end gap-0.5 border-b border-[#cfd6e0]"
          role="tablist"
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            const Icon = resolveIcon(item);
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-tab-id={item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                  active
                    ? "-mb-px rounded-t-md border border-b-0 border-[#cfd6e0] bg-card font-semibold text-[#003F7D]"
                    : "mb-px font-medium text-slate-500 hover:text-slate-800",
                )}
              >
                {Icon ? (
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "text-[#003F7D]" : "text-slate-400",
                    )}
                    aria-hidden
                  />
                ) : null}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subnav on white — clear break from grey tab track */}
      {subnavNode ? (
        <div className="border-b border-border-soft bg-card px-4 py-2.5">
          {subnavNode}
        </div>
      ) : null}

      <div
        className={cn(
          "bg-card px-4",
          subnavNode ? "py-3" : "pt-3 pb-3",
        )}
      >
        {notice ? <div className="mb-2">{notice}</div> : null}
        {children(tab)}
      </div>
    </div>
  );
}

export function RecordActions({
  onCancel,
  onSave,
}: {
  onCancel?: () => void;
  onSave?: () => void;
}) {
  return (
    <>
      {onCancel ? (
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
      {onSave ? (
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
      ) : null}
    </>
  );
}
