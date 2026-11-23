"use client";

import { useState } from "react";
import { Camera, Check, Images, Plus, Ruler, ScanSearch, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaQuickReply, PaSiteScope } from "./pro-assistant-api";

const CONFIDENCE: Record<string, { label: string; className: string }> = {
  high: { label: "High confidence", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  medium: { label: "Medium confidence", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  low: { label: "Low confidence", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};
const SOURCE: Record<string, string> = { pro: "Your dimensions", ai: "AI approximate", ai_suggested: "AI estimate" };

/** What the co-pilot read from the site photos: trade, area, findings, likely scope and size. */
export function SiteScopeCard({ scope }: { scope: PaSiteScope }) {
  const dims = scope.dimensions;
  const tone = dims?.confidence ? CONFIDENCE[dims.confidence] : null;
  return (
    <div className="w-full max-w-[92%] overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
      <div className="flex items-center gap-2 border-b bg-primary/[0.04] px-3 py-2">
        <ScanSearch className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-semibold">
          {scope.trade}
          {scope.area ? <span className="font-normal text-muted-foreground"> · {scope.area}</span> : null}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <Images className="size-3.5" aria-hidden />
          {scope.photoCount}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-3 py-2.5">
        {scope.summary ? <p className="text-[13px] leading-5 text-foreground/85">{scope.summary}</p> : null}
        {scope.findings.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="What the photos show">
            {scope.findings.map((item) => (
              <li key={item} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/80">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {scope.scopeItems.length && (scope.status === "ready" || scope.status === "drafted") ? (
          <div>
            <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Likely scope</p>
            <ul className="flex flex-col gap-0.5">
              {scope.scopeItems.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[12.5px]">
                  <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {dims?.label ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed px-2.5 py-1.5">
            <Ruler className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-[12.5px] font-semibold tabular-nums">{dims.label}</span>
            <span className="text-[11px] text-muted-foreground">{SOURCE[dims.source] || ""}</span>
            {tone && dims.source !== "pro" ? (
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", tone.className)}>{tone.label}</span>
            ) : null}
            {dims.basis && dims.source !== "pro" ? (
              <p className="w-full text-[11px] leading-4 text-muted-foreground">Based on {dims.basis.replace(/^based on\s+/i, "")}</p>
            ) : null}
          </div>
        ) : null}
        {scope.missing.length && scope.status === "awaiting_dimensions" ? (
          <p className="text-[11.5px] text-amber-700 dark:text-amber-300">Not visible: {scope.missing.join("; ")}</p>
        ) : null}
      </div>
    </div>
  );
}

const CHIP_ICON: Record<PaQuickReply["kind"], typeof Camera> = {
  confirm: Check,
  reject: Wand2,
  upload_more: Camera,
  enter_dimensions: Ruler,
  use_ai_dimensions: Sparkles,
  draft: Sparkles,
  revise: Plus,
};

/**
 * Structured chips under a reply. "Enter dimensions" opens a one-line input in place (Enter sends);
 * the rest are handled by the parent (send the action, open the picker, prefill the box).
 */
export function QuickReplies({
  items,
  onPick,
  onDimensions,
}: {
  items: PaQuickReply[];
  onPick: (item: PaQuickReply) => void;
  onDimensions: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const submit = () => {
    const clean = value.trim();
    if (!clean) return;
    onDimensions(clean);
    setEditing(false);
    setValue("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const Icon = CHIP_ICON[item.kind] || Sparkles;
          const primary = item.kind === "confirm" || item.kind === "draft";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (item.kind === "enter_dimensions" ? setEditing((v) => !v) : onPick(item))}
              aria-expanded={item.kind === "enter_dimensions" ? editing : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition max-sm:min-h-9 max-sm:px-3",
                primary
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background text-foreground/80 hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                item.kind === "enter_dimensions" && editing && "border-primary/50 bg-primary/5 text-primary",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex w-full max-w-sm items-center gap-1.5"
        >
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={80}
            placeholder="e.g. 12x14 ft, 12 x 14 x 9 ft or 1500 sq ft"
            aria-label="Dimensions"
            className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-xs max-sm:h-10 max-sm:text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="h-8 shrink-0 rounded-lg bg-primary px-3 text-xs max-sm:h-10 max-sm:px-4 font-semibold text-primary-foreground disabled:opacity-40"
          >
            Use
          </button>
        </form>
      ) : null}
    </div>
  );
}
