"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALL_HISTORY_PATH } from "./ai-call-history";
import { callNumberOf, fetchAiCalls, type AiCallSummary } from "./call-logs";

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
 * Notes written by the AI receptionist before calls kept the transcript out of them: the text up
 * to the "Call transcript:" / "Transcript:" block (the call log has the conversation).
 */
export function withoutCallTranscript(text: string) {
  const value = String(text || "");
  const cut = value.search(/\n\s*(Call transcript|Transcript):\s*\n/);
  return cut === -1 ? value : value.slice(0, cut).trimEnd();
}
