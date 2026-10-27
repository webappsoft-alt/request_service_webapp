"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select can't use "" as an item value, so "All sources" is this sentinel. */
const ALL = "all";

/** "Source" dropdown for the Customers / Leads tables and the customer picker ("" = All). */
export function SourceFilter<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
  className,
}: {
  value: T | "";
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (next: T | "") => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select
      value={value || ALL}
      onValueChange={(next) => onChange(next === ALL ? "" : (next as T))}
    >
      <SelectTrigger size={size} className={cn("w-40", className)} aria-label="Filter by source">
        <SelectValue placeholder="All sources" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL}>All sources</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} title={option.hint}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
