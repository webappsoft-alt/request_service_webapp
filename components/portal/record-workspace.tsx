"use client";

import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOpenRecords } from "@/components/portal/use-open-records";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecordTab = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

export function RecordWorkspace({
  href,
  label,
  kind,
  tabs,
  actions,
  badge,
  notice,
  children,
}: {
  href: string;
  label: string;
  kind: string;
  tabs: RecordTab[];
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
    <div className="border border-black/15 bg-card">
      <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{label}</h1>
          {badge}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="bg-[#eef1f5] px-3 pt-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-t-md border px-3 py-2 text-[13px] font-medium",
                  active
                    ? "-mb-px border-black/10 border-b-card bg-card text-primary shadow-[0_-1px_0_#003F7D]"
                    : "border-transparent text-muted-foreground hover:bg-white/70 hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-black/10 bg-card p-4">
        {notice ? <div className="mb-4">{notice}</div> : null}
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
