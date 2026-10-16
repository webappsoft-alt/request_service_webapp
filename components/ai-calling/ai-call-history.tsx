"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Headphones, Loader2, PhoneIncoming, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchAiCalls,
  formatCallDuration,
  formatCallTime,
  outcomeMeta,
  type AiCallChannel,
  type AiCallListResponse,
  type AiCallSummary,
} from "./call-logs";
import { formatPhone } from "./phone";

export const CALL_HISTORY_PATH = "/pro/dashboard/ai-receptionist/calls";

export function AiCallOutcomeBadge({ call, className }: { call: Pick<AiCallSummary, "status" | "outcome">; className?: string }) {
  const meta = outcomeMeta(call);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

function callerLabel(call: AiCallSummary) {
  if (call.customerName) return call.customerName;
  if (call.channel === "browser_test") return "Browser test call";
  return call.callerPhone ? formatPhone(call.callerPhone) : "Unknown caller";
}

function CallRow({ call }: { call: AiCallSummary }) {
  const ChannelIcon = call.channel === "browser_test" ? Headphones : PhoneIncoming;
  return (
    <li>
      <Link
        href={`${CALL_HISTORY_PATH}/${call.id}`}
        className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            call.channel === "browser_test" ? "bg-violet-500/10 text-violet-600 dark:text-violet-300" : "bg-primary/10 text-primary",
          )}
          aria-hidden="true"
        >
          <ChannelIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground">{callerLabel(call)}</span>
            <AiCallOutcomeBadge call={call} />
            {call.channel === "browser_test" ? (
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground uppercase">
                Test
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {call.preview ? `“${call.preview}”` : "No caller speech"}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{formatCallTime(call.startedAt)}</span>
            <span>{call.status === "in_progress" ? "Live now" : formatCallDuration(call.durationSec)}</span>
            {typeof call.turns === "number" ? <span>{call.turns} caller turn{call.turns === 1 ? "" : "s"}</span> : null}
            {call.leadNumber ? <span className="font-medium text-foreground/80">{call.leadNumber}</span> : null}
            {call.estimateNumber ? <span className="font-medium text-foreground/80">{call.estimateNumber}</span> : null}
          </span>
        </span>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

const FILTERS: { id: AiCallChannel | ""; label: string }[] = [
  { id: "", label: "All calls" },
  { id: "phone", label: "Phone" },
  { id: "browser_test", label: "Test calls" },
];

/**
 * AI receptionist call history. `compact` shows only the latest few (settings page card);
 * otherwise a filterable, paginated list.
 */
export function AiCallHistory({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const pageSize = limit || (compact ? 5 : 20);
  const [channel, setChannel] = useState<AiCallChannel | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AiCallListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAiCalls({ page, limit: pageSize, channel }).then(
      (next) => {
        if (cancelled) return;
        setResult(next);
        setError("");
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setError("Could not load call history.");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, channel, attempt]);

  const calls = result?.data || [];
  const pagination = result?.pagination;

  const reload = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="radiogroup" aria-label="Filter calls" className="inline-flex rounded-lg border border-border-soft bg-muted/40 p-0.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.id || "all"}
                type="button"
                role="radio"
                aria-checked={channel === filter.id}
                onClick={() => {
                  setLoading(true);
                  setChannel(filter.id);
                  setPage(1);
                }}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                  channel === filter.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            Refresh
          </Button>
        </div>
      ) : null}

      {loading && !result ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: compact ? 3 : 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4" aria-hidden="true" /> {error}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border-soft px-4 py-8 text-center">
          <PhoneIncoming className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-1 text-sm font-medium text-foreground">No calls yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Every call the AI receptionist answers (including browser test calls) shows up here with the full conversation.
          </p>
        </div>
      ) : (
        <ul className={cn("-mx-3 flex flex-col divide-y divide-border-soft", loading && "opacity-60")}>
          {calls.map((call) => (
            <CallRow key={call.id} call={call} />
          ))}
        </ul>
      )}

      {!compact && pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-3 text-xs text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} calls
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
