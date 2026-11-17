"use client";

import { ArrowUpRight, Check, ChevronRight, Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaAction } from "./pro-assistant-api";

/**
 * Co-pilot result cards: a live list (overdue invoices, new leads…), a facts card (timesheets,
 * live status, business snapshot) and the Confirm card for changes (nothing changes until the Pro
 * presses Confirm — the server then runs the action it stored, once).
 */

type ListAction = Extract<PaAction, { type: "list" }>;
type InfoAction = Extract<PaAction, { type: "info" }>;
type ConfirmAction = Extract<PaAction, { type: "confirm" }>;

const usd = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function OpenLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
    >
      {label}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </button>
  );
}

export function ListCard({ action, onOpen }: { action: ListAction; onOpen: (href: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold">
          {action.title}
          <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-px text-[11px] text-primary">{action.total}</span>
        </p>
        {action.amountDue ? <p className="text-xs font-semibold tabular-nums">{usd(action.amountDue)} due</p> : null}
      </div>
      {action.items.length ? (
        action.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.href)}
            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              {item.subtitle ? <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">Nothing here right now.</p>
      )}
      {action.total > action.items.length ? (
        <button type="button" onClick={() => onOpen(action.href)} className="w-full border-t px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-muted">
          See all {action.total}
        </button>
      ) : null}
    </div>
  );
}

export function InfoCard({ action, onOpen }: { action: InfoAction; onOpen: (href: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <p className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold">{action.title}</p>
        <dl className="divide-y">
          {action.rows.map(([label, value]) => (
            <div key={`${label}-${value}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {action.href ? <OpenLink label={action.hrefLabel || "Open"} onClick={() => onOpen(action.href || "")} /> : null}
    </div>
  );
}

/** Confirm / Cancel are run by the chat (also by voice: "yes" / "cancel"). */
export function ConfirmCard({
  action,
  onConfirm,
  onCancel,
  onOpen,
}: {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
  onOpen: (href: string) => void;
}) {
  const running = action.status === "running";
  const finished = action.status === "done" || action.status === "cancelled";
  const error = action.status === "pending" ? action.result?.error : null;
  const confirm = onConfirm;
  const cancel = onCancel;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        action.status === "done" && "border-emerald-300 dark:border-emerald-800/60",
        action.status === "cancelled" && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
        <ShieldCheck className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-amber-900 dark:text-amber-200">{action.title}</p>
        <span className="text-[10px] font-semibold tracking-wide text-amber-800/80 uppercase dark:text-amber-300/80">
          {action.status === "done" ? "Done" : action.status === "cancelled" ? "Cancelled" : "Needs your OK"}
        </span>
      </div>
      <dl className="divide-y">
        {action.details.map(([label, value]) => (
          <div key={`${label}-${value}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
            <dd className="text-right text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {error ? <p className="border-t bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
      {action.status === "done" && action.result?.replyText ? (
        <div className="flex flex-col gap-2 border-t bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
          <p className="flex items-start gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <Check className="mt-px size-3.5 shrink-0" aria-hidden />
            {action.result.replyText}
          </p>
          {action.result.href ? <OpenLink label={action.result.hrefLabel || "Open"} onClick={() => onOpen(action.result?.href || "")} /> : null}
        </div>
      ) : null}
      {!finished ? (
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={running}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <X className="size-3.5" aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={running}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            {action.confirmLabel || "Confirm"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
