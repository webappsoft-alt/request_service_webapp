import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nested filter tabs.
 * Use `flush` when rendered inside RecordWorkspace `subnav` slot
 * (parent already provides full-bleed secondary bg — no radius, no own bg).
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
  /** Inside RecordWorkspace subnav — no bg/radius; parent bar is full-bleed. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2",
        flush ? "rounded-none bg-transparent p-0" : "rounded-md bg-secondary px-4 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "cursor-pointer py-0.5 text-sm leading-none transition-colors",
                active
                  ? "font-bold text-foreground"
                  : "font-medium text-primary hover:underline",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {trailing ? (
        <div className="flex h-8 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
