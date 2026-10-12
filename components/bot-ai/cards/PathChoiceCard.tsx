"use client";

import { ChevronRight, FileText, ShieldCheck, Tag } from "lucide-react";
import { PATH_LABELS, useBot } from "../BotProvider";
import type { BotChoices, BotPath } from "../types";

type Option = { path: BotPath; title: string; detail: string; icon: typeof ShieldCheck };

/**
 * 3-way choice once the job is identified. Pros and fixed-price services appear only when
 * they exist for this job near the customer; the custom quotation whenever a pro serves the
 * address (the backend never sends a choice card when none does). Full drawer width.
 */
export function PathChoiceCard({ choices, active }: { choices: BotChoices; active: boolean }) {
  const { choosePath } = useBot();
  const where = choices.locationLabel ? ` near ${choices.locationLabel}` : "";

  const options: Option[] = [];
  if (choices.pros) {
    const count = `${choices.pros.count}${choices.pros.more ? "+" : ""}`;
    options.push({
      path: "pros",
      title: PATH_LABELS.pros,
      detail: `${count} ${choices.pros.count === 1 ? "pro" : "pros"} for this job${where}`,
      icon: ShieldCheck,
    });
  }
  if (choices.services) {
    const count = `${choices.services.count}${choices.services.more ? "+" : ""}`;
    const from = choices.services.fromPrice != null ? ` · from $${choices.services.fromPrice.toLocaleString("en-US")}` : "";
    options.push({
      path: "services",
      title: PATH_LABELS.services,
      detail: `${count} ${choices.services.count === 1 ? "package" : "packages"}, book instantly${from}`,
      icon: Tag,
    });
  }
  if (choices.quote.available) {
    const reach = choices.quote.count;
    const direct = choices.quote.direct;
    options.push({
      path: "quote",
      title: PATH_LABELS.quote,
      detail: direct
        ? `Free estimate from ${direct.name}, the nearest pro — I'll write up the job, no forms`
        : reach
          ? `Free estimates from ${reach} matching ${reach === 1 ? "pro" : "pros"} — I'll write up the job, no forms`
          : "Free estimates — I'll write up the job for the pros, no forms",
      icon: FileText,
    });
  }

  return (
    <div className="flex w-full flex-col gap-1.5" role="group" aria-label={`Options for ${choices.subject}`}>
      {options.map((option) => (
        <button
          key={option.path}
          type="button"
          disabled={!active}
          onClick={() => choosePath(option.path)}
          className="group flex items-center gap-2.5 rounded-xl border bg-card p-2.5 text-left text-card-foreground shadow-xs transition hover:border-primary/50 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-60"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <option.icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">{option.title}</span>
            <span className="block text-[10px] text-muted-foreground">{option.detail}</span>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
