import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PortalPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  badge,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#94a3b8] dark:border-border bg-white dark:bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 dark:text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-foreground sm:text-[1.35rem]">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <div className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-500 dark:text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className={cn("flex flex-wrap gap-2")}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
