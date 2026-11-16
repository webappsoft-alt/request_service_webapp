"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CALL_HISTORY_PATH } from "./ai-call-history";
import {
  callNumberOf,
  fetchAiCalls,
  formatCallDuration,
  formatCallTime,
  type AiCallSummary,
} from "./call-logs";

/**
 * "View call" for a record the AI receptionist created: opens the latest call that created or
 * updated this estimate (its conversation, captured details and booking). Renders nothing when
 * there is no such call.
 */
export function LinkedCallButton({ opportunityId }: { opportunityId: string }) {
  const [call, setCall] = useState<AiCallSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiCalls({ opportunityId, limit: 1 }).then(
      (result) => {
        if (!cancelled) setCall(result?.data?.[0] || null);
      },
      () => {
        /* no button */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  if (!call) return null;
  return (
    <Button
      asChild
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
    >
      <Link
        href={`${CALL_HISTORY_PATH}/${call.id}`}
        title={`Conversation and captured details of ${callNumberOf(call)}`}
      >
        <PhoneCall className="size-3.5" aria-hidden="true" /> View call
      </Link>
    </Button>
  );
}

/**
 * Work request "Internal notes" for an estimate the AI receptionist created: a clean card for the
 * call (number, time, length, what the AI did) with "View call log", which opens the call's detail
 * page — instead of the raw call notes / transcript. While loading it shows a skeleton; when no call
 * is found it renders `fallback` (the notes).
 */
export function CallLogCard({
  opportunityId,
  fallback = null,
}: {
  opportunityId: string;
  fallback?: ReactNode;
}) {
  const [state, setState] = useState<{
    id: string;
    call: AiCallSummary | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiCalls({ opportunityId, limit: 1 }).then(
      (result) => {
        if (!cancelled)
          setState({ id: opportunityId, call: result?.data?.[0] || null });
      },
      () => {
        if (!cancelled) setState({ id: opportunityId, call: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  if (!state || state.id !== opportunityId) {
    return <Skeleton className="h-18.5 w-full rounded-xl" />;
  }
  const { call } = state;
  if (!call) return <>{fallback}</>;

  const meta = [
    callNumberOf(call),
    formatCallTime(call.startedAt),
    call.status === "completed" && call.durationSec
      ? formatCallDuration(call.durationSec)
      : "",
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 sm:flex-row sm:items-center dark:border-border dark:bg-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <PhoneCall className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
          Created from an AI receptionist call
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground">
          {meta.join(" · ")}
        </p>
        {call.summary ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-foreground/90">
            {call.summary}
          </p>
        ) : null}
      </div>
      <Button asChild size="sm" className="h-9 shrink-0 gap-1.5">
        <Link
          href={`${CALL_HISTORY_PATH}/${call.id}`}
          title={`Conversation and captured details of ${callNumberOf(call)}`}
        >
          <PhoneCall className="size-3.5" aria-hidden="true" /> View call log
        </Link>
      </Button>
    </div>
  );
}

/**
 * Notes written by the AI receptionist before calls kept the transcript out of them: the text up
 * to the "Call transcript:" / "Transcript:" block (the call log has the conversation).
 */
export function withoutCallTranscript(text: string) {
  const value = String(text || "");
  const cut = value.search(/\n\s*(Call transcript|Transcript):\s*\n/);
  return cut === -1 ? value : value.slice(0, cut).trimEnd();
}
