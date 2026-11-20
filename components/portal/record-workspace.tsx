"use client";

import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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
import { MobileActionsMenu } from "@/components/portal/mobile-actions-menu";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecordTab = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Items needing attention — shown as a pulsing badge next to the label. */
  alert?: number;
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
  metaBar,
  notice,
  trackOpen = true,
  backHref,
  backLabel = "Back",
  children,
}: {
  /** Icon-only back arrow before the title (replaces verbose "Back to …" buttons). */
  backHref?: string;
  backLabel?: string;
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
  /** Persistent info bar (Customer / Site / Total / Status), shown under the title row. */
  metaBar?: ReactNode;
  notice?: ReactNode;
  /** Add this record to the Pro open-records tab strip (off in the technician portal). */
  trackOpen?: boolean;
  children: (tab: string) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openRecord } = useOpenRecords();
  const tabParam = searchParams.get("tab");
  const tab =
    tabs.some((item) => item.id === tabParam) && tabParam
      ? tabParam
      : tabs[0]?.id ?? "profile";
  const hasSubnav = subnavTabs.includes(tab);
  const subnavNode = hasSubnav && subnav ? subnav(tab) : null;

  // Phones scroll the tab row sideways: keep the active tab in view (scrolls the row only, never the page).
  const tabListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabListRef.current;
    const active = list?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tab)}"]`);
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: Math.max(0, active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2), behavior: "smooth" });
  }, [tab]);

  useEffect(() => {
    if (trackOpen) openRecord({ href, label, kind });
  }, [href, kind, label, openRecord, trackOpen]);

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === tabs[0]?.id) params.delete("tab");
    else params.set("tab", next);
    // One-shot deep-link flags — do not keep reopening modals on tab revisit.
    params.delete("create");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="bg-card">
      {/* Phones: title on the left, actions in a ⋮ menu on the right (MobileActionsMenu). */}
      <div className="flex items-start justify-between gap-2 border-b border-border-soft px-4 py-2 sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {backHref ? (
            <Link
              href={backHref}
              aria-label={backLabel}
              title={backLabel}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border-border dark:text-muted-foreground print:hidden"
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {label}
          </h1>
          {badge}
        </div>
        {actions ? (
          <MobileActionsMenu
            label="Record actions"
            className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto print:hidden"
          >
            {actions}
          </MobileActionsMenu>
        ) : null}
      </div>

      {metaBar ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-b border-border-soft dark:border-border bg-[#f7f8fa] dark:bg-slate-800/60 px-4 py-2 text-sm">
          {metaBar}
        </div>
      ) : null}

      {/* Main folder tabs — grey track only */}
      <div className="bg-[#e8ecf1] dark:bg-slate-900/90 px-3 pt-2 sm:px-4 print:hidden">
        <div
          ref={tabListRef}
          // Phones: one swipeable row; the baseline is an inset shadow (not a border) so the
          // active tab still sits on it inside the scroll box. sm+: the original wrapped tabs.
          className="no-scrollbar flex items-end gap-0.5 overflow-x-auto shadow-[inset_0_-1px_0_#cfd6e0] dark:shadow-[inset_0_-1px_0_var(--border)] sm:flex-wrap sm:overflow-visible sm:border-b sm:border-[#cfd6e0] sm:shadow-none dark:sm:border-border dark:sm:shadow-none"
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
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                  active
                    ? "-mb-px rounded-t-md border border-b-0 border-[#cfd6e0] dark:border-border bg-card font-semibold text-[#003F7D] dark:text-primary"
                    : "mb-px font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
                )}
              >
                {Icon ? (
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "text-[#003F7D] dark:text-primary" : "text-slate-400 dark:text-slate-500",
                    )}
                    aria-hidden
                  />
                ) : null}
                <span className="whitespace-nowrap">{item.label}</span>
                {item.alert ? (
                  <span className="relative inline-flex" aria-label={`${item.alert} pending`}>
                    <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-60" aria-hidden />
                    <span className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
                      {item.alert > 99 ? "99+" : item.alert}
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subnav on white — clear break from grey tab track */}
      {subnavNode ? (
        <div className="border-b border-border-soft bg-card px-4 py-2.5 print:hidden">
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
