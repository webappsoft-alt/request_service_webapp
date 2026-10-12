"use client";

import { MapPin, Wrench, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { findCategory, findProvider, findSubService } from "../mockData";
import type { BotConversationState, BotStep } from "../types";

const STEP_LABELS: Record<BotStep, string> = {
  1: "Identifying Service",
  2: "Choosing Provider",
  3: "Quote / Booking",
};

export function CapturedContextCard({
  state,
  locationLabel,
}: {
  state: BotConversationState;
  locationLabel: string;
}) {
  const category = findCategory(state.categorySlug);
  const sub = findSubService(state.subServiceId);
  const provider = findProvider(state.providerId);

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card/80 p-2.5 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/70">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold",
            locationLabel
              ? "bg-primary/10 text-primary"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{locationLabel || "Location not set"}</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
          Step {state.step} of 3: <span className="text-foreground">{STEP_LABELS[state.step]}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1" aria-hidden>
        {([1, 2, 3] as BotStep[]).map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 rounded-full transition-colors duration-500",
              step <= state.step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {category || provider ? (
        <div className="flex flex-wrap gap-1">
          {category ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              <Wrench className="size-2.5" aria-hidden />
              {sub ? `${category.name} · ${sub.name}` : category.name}
            </span>
          ) : null}
          {provider ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <UserCheck className="size-2.5" aria-hidden />
              {provider.name}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
