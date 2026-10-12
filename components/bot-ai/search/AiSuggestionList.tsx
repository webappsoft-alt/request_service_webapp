"use client";

import { ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotSearchSuggestion } from "../types";

/**
 * Inline dropdown under the hero search: "Plumbing → Kitchen Pipe Leak Repair".
 * Picking one opens the AI assistant with that service already identified.
 */
export function AiSuggestionList({
  id,
  suggestions,
  loading,
  empty,
  activeIndex,
  optionIdPrefix,
  onHover,
  onChoose,
}: {
  id: string;
  suggestions: BotSearchSuggestion[];
  loading: boolean;
  /** Search finished with no match. */
  empty: boolean;
  activeIndex: number;
  optionIdPrefix: string;
  onHover: (index: number) => void;
  onChoose: (suggestion: BotSearchSuggestion) => void;
}) {
  return (
    <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-64 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl sm:w-[26rem]">
      <div className="flex items-center gap-1.5 border-b px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
        <Sparkles className="size-3 text-primary" aria-hidden />
        {loading && !suggestions.length ? "Finding the right service…" : "Best matches for your problem"}
        {loading && suggestions.length ? <Loader2 className="ml-auto size-3 animate-spin" aria-hidden /> : null}
      </div>

      {suggestions.length ? (
        <ul id={id} role="listbox" className="max-h-80 overflow-y-auto py-1">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="presentation">
              <button
                type="button"
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => onHover(index)}
                onClick={() => onChoose(suggestion)}
                className={cn(
                  "group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted",
                  index === activeIndex && "bg-muted",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{suggestion.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {suggestion.categoryName}
                    {suggestion.subCategoryName && suggestion.subCategoryName !== suggestion.label
                      ? ` → ${suggestion.subCategoryName}`
                      : ""}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary opacity-0 transition group-hover:opacity-100 group-aria-selected:opacity-100 sm:flex">
                  Get help
                  <ChevronRight className="size-3.5" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : loading ? (
        <div className="flex flex-col gap-2 px-3.5 py-3" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex flex-col gap-1.5">
              <span className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <span className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <p className="px-3.5 py-3 text-xs text-muted-foreground">
          No matching service yet — try describing it differently, e.g. “water dripping under the sink”.
        </p>
      ) : null}
    </div>
  );
}
