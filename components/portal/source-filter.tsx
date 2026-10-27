"use client";

import { Fragment } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select can't use "" as an item value, so "All sources" is this sentinel. */
const ALL = "all";

type FilterOption<T extends string> = { value: T; label: string; hint: string; group?: string };

/**
 * "Source" dropdown for the Customers / Leads tables and the customer picker ("" = All).
 * Options with a `group` are listed under that heading (e.g. Source, Account).
 */
export function SourceFilter<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
  className,
}: {
  value: T | "";
  options: Array<FilterOption<T>>;
  onChange: (next: T | "") => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const groups: Array<{ name: string; items: Array<FilterOption<T>> }> = [];
  for (const option of options) {
    const name = option.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(option);
    else groups.push({ name, items: [option] });
  }

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
        {groups.map((group) => (
          <Fragment key={group.name || "options"}>
            {group.name ? <SelectSeparator /> : null}
            <SelectGroup>
              {group.name ? <SelectLabel>{group.name}</SelectLabel> : null}
              {group.items.map((option) => (
                <SelectItem key={option.value} value={option.value} title={option.hint}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}
