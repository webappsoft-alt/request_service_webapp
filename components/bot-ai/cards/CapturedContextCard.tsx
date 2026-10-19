"use client";

import { MapPin, Pencil, UserCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotConversationContext, BotStep } from "../types";

const STEPS: { id: BotStep; label: string }[] = [
  { id: "identifying", label: "Identifying Service" },
  { id: "provider_selection", label: "Choosing Provider" },
  { id: "quote_or_booking", label: "Quote / Booking" },
];

export function CapturedContextCard({
  context,
  locationLabel,
  connected,
  onChangeAddress,
}: {
  context: BotConversationContext;
  locationLabel: string;
  connected: boolean;
  onChangeAddress: () => void;
}) {
  const stepIndex = Math.max(0, STEPS.findIndex((step) => step.id === context.step));
  const category = context.categoryName;
  const sub = context.subCategoryName;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card/80 p-2.5 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/70">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onChangeAddress}
          title="Change address"
          aria-label={`${locationLabel || "Location not set"} — change address`}
          className={cn(
            // Soft neutral container (#F5F5F5) matching the card around it.
            "inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[11px] font-semibold transition hover:bg-[#EBEBEB] dark:bg-white/10 dark:hover:bg-white/15",
            locationLabel ? "text-foreground" : "text-amber-700 dark:text-amber-300",
          )}
        >
          <MapPin className={cn("size-3 shrink-0", locationLabel ? "text-primary" : "")} aria-hidden />
          <span className="truncate">{locationLabel || "Set your address"}</span>
          <Pencil className="size-2.5 shrink-0 opacity-60" aria-hidden />
        </button>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
          Step {stepIndex + 1} of 3: <span className="text-foreground">{STEPS[stepIndex].label}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1" aria-hidden>
        {STEPS.map((step, index) => (
          <span
            key={step.id}
            className={cn(
              "h-1 rounded-full transition-colors duration-500",
              index <= stepIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      {category || context.providerName || !connected ? (
        <div className="flex flex-wrap gap-1">
          {category ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              <Wrench className="size-2.5" aria-hidden />
              {sub ? `${category} · ${sub}` : category}
            </span>
          ) : null}
          {context.providerName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              <UserCheck className="size-2.5" aria-hidden />
              {context.providerName}
            </span>
          ) : null}
          {!connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
              Connecting…
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
