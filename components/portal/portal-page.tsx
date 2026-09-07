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
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-b border-black/10 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p>
          ) : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className={cn("flex flex-wrap gap-2")}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
