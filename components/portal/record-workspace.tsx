"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecordTab = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/**
 * Simpro-style record chrome.
 * When `subnav` returns content for the active tab, it renders as a full-width
 * secondary bar flush under the folder tab (no gap, no radius, edge-to-edge).
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
  /** Tab ids that show a nested filter bar under the folder tab. */
  subnavTabs?: string[];
  /** Nested filters / actions for tabs in `subnavTabs` (All / Open / Create…). */
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
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{label}</h1>
          {badge}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {/* Folder tabs + optional flush subnav — one attached block */}
      <div className={cn(hasSubnav && subnavNode ? "bg-secondary" : undefined)}>
        <div className={cn("px-4 pt-1 pb-0", hasSubnav && subnavNode ? "bg-card" : "bg-card")}>
          <div className="flex flex-wrap items-end gap-0.5">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-tab-id={item.id}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm transition-colors",
                    active
                      ? hasSubnav && subnavNode
                        ? "-mb-px rounded-t-md bg-secondary font-bold text-foreground"
                        : "rounded-md bg-secondary font-bold text-foreground"
                      : "font-medium text-primary hover:underline",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {subnavNode ? (
          <div className="flex w-full items-center rounded-none bg-secondary py-2 pl-7 pr-4">
            {subnavNode}
          </div>
        ) : null}
      </div>

      <div className={cn("bg-card px-4", hasSubnav && subnavNode ? "py-3" : "pt-1.5 pb-3")}>
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
