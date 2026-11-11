"use client";

import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Eye,
  FolderOpen,
  GitPullRequestArrow,
  ListChecks,
  Receipt,
  Table2,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Small count / status on the right. */
  meta?: string;
};

type NavGroup = { id: string; title: string; items: NavItem[] };

/** A details entry (Customer, Work request, Preparation…): renders in the centre like every other item. */
export type ProjectDetailTab = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  meta?: string;
};

/** What the project has — a section is listed only when it has something to show. */
export type ProjectNavCounts = {
  lines: number;
  optional: number;
  hasJob: boolean;
  changeOrders: number;
  schedule: number;
  invoices: number;
  files: number;
};

const count = (n: number) => (n ? String(n) : undefined);

/** The project sections that have data, in sidebar order. */
export function projectNavGroups(counts: ProjectNavCounts, accepted: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "pre",
      title: "Pre-production",
      items: [
        // Client: Summary (the estimate itself) first, Parts & Labour (read-only line items) under it.
        { id: "estimate", label: "Summary", icon: Table2 },
        ...(counts.lines ? [{ id: "parts", label: "Parts & Labour", icon: Wrench, meta: count(counts.lines) }] : []),
        ...(counts.lines ? [{ id: "preview", label: "Preview", icon: Eye, meta: accepted ? "Signed" : undefined }] : []),
        ...(counts.optional ? [{ id: "selections", label: "Selections", icon: ListChecks, meta: `${counts.optional} optional` }] : []),
      ],
    },
    {
      id: "production",
      title: "Production",
      items: [
        ...(counts.hasJob ? [{ id: "progress", label: "Progress", icon: ClipboardList }] : []),
        ...(counts.changeOrders ? [{ id: "change-orders", label: "Change orders", icon: GitPullRequestArrow, meta: count(counts.changeOrders) }] : []),
        ...(counts.schedule ? [{ id: "schedule", label: "Schedule", icon: CalendarDays, meta: count(counts.schedule) }] : []),
        ...(counts.invoices ? [{ id: "invoices", label: "Invoices", icon: Receipt, meta: count(counts.invoices) }] : []),
        // Budget stays, moved to the end of Production (client).
        ...(counts.lines ? [{ id: "budget", label: "Budget", icon: Wallet }] : []),
      ],
    },
    {
      id: "project",
      title: "Project",
      items: counts.files ? [{ id: "files", label: "Project files", icon: FolderOpen, meta: count(counts.files) }] : [],
    },
  ];
  return groups.filter((group) => group.items.length);
}

/**
 * The open estimate's project menu (Bolster-style). Every item renders its section in the centre of
 * this page (`onView`); nothing navigates away, and sections with nothing to show are not listed.
 */
export function ProjectLifecycleNav({
  header,
  groups,
  view,
  onView,
  details = [],
  footer,
  className,
}: {
  /** The estimate's number, title and status (top of the menu). */
  header?: ReactNode;
  groups: NavGroup[];
  /** What the centre shows: "estimate" (the sheet) or another section id. */
  view: string;
  onView: (view: string) => void;
  details?: ProjectDetailTab[];
  /** Pinned to the bottom of the menu (e.g. the follow-up form). */
  footer?: ReactNode;
  className?: string;
}) {
  const allGroups = [...groups, ...(details.length ? [{ id: "details", title: "Details", items: details }] : [])];
  // Phones: one swipeable row of tabs (left to right); keep the open tab in view.
  const stripRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>("[aria-current=page]");
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [view]);

  return (
    <nav
      aria-label="Project"
      className={cn(
        // At least the screen height below the header, never an inner scroll (client); no shadow.
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white lg:min-h-[calc(100dvh-72px)] dark:border-border dark:bg-card",
        className,
      )}
    >
      {header ? (
        <div className="border-b border-slate-200/70 px-3.5 pt-3 pb-2.5 dark:border-border-soft">
          {header}
        </div>
      ) : null}
      <ul
        ref={stripRef}
        aria-label="Project sections"
        className="flex snap-x gap-1.5 overflow-x-auto px-2.5 py-2.5 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        {allGroups.flatMap((group) => group.items).map((item) => {
          const isActive = view === item.id;
          const Icon = item.icon;
          return (
            <li key={item.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isActive
                    ? "border-primary bg-primary font-semibold text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-700 dark:border-border dark:bg-card dark:text-foreground",
                )}
                onClick={() => onView(item.id)}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {item.label}
                {item.meta ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      isActive ? "bg-white/20" : "bg-slate-100 text-slate-500 dark:bg-muted",
                    )}
                  >
                    {item.meta}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hidden space-y-2 px-2.5 py-2 lg:block">
        {allGroups.map((group) => (
          <div key={group.id}>
            <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">{group.title}</p>
            <ul>
              {group.items.map((item) => {
                const isActive = view === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        isActive
                          ? "bg-primary/[0.07] font-semibold text-primary"
                          : "text-slate-700 hover:bg-slate-50 dark:text-foreground dark:hover:bg-muted/60",
                      )}
                      onClick={() => onView(item.id)}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary dark:bg-muted",
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta ? (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
                            isActive ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500 dark:bg-muted",
                          )}
                        >
                          {item.meta}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {footer ? (
        <>
          {/* Follow-up folds into one row at the bottom (opens on click), so the menu never needs to scroll. */}
          <details className="group border-t border-slate-100 lg:mt-auto dark:border-border-soft">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase hover:text-primary [&::-webkit-details-marker]:hidden">
              <CalendarClock className="size-3.5" aria-hidden />
              <span className="flex-1">Follow-up</span>
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="px-3.5 pb-3.5">{footer}</div>
          </details>
        </>
      ) : null}
    </nav>
  );
}
