import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nested filter tabs — underline style on white (not folder tabs).
 * Keeps hierarchy clear under RecordWorkspace main tabs.
 */
export function LocalFilterTabs({
  value,
  onChange,
  options,
  trailing,
  flush,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  trailing?: ReactNode;
  /** Inside RecordWorkspace subnav — already on white. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2",
        flush ? "p-0" : "rounded-md border border-border-soft bg-card px-3 py-2",
        className,
      )}
    >
      <div
        className="flex flex-wrap items-center gap-0.5"
        role="tablist"
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "cursor-pointer border-b-2 px-2.5 py-1 text-sm transition-colors",
                active
                  ? "border-[#003F7D] dark:border-primary font-semibold text-[#003F7D] dark:text-primary"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          );
        })}
      </div>
      {trailing ? (
        <div className="flex h-8 shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
