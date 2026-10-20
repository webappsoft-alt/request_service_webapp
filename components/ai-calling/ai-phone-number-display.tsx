"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Copy, Lock, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhone } from "./phone";
import type { AiPhoneNumberStatus } from "./types";

const STATUS_STYLES: Record<AiPhoneNumberStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400 dark:ring-emerald-400/30",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-400 dark:ring-amber-400/30",
  },
  unassigned: {
    label: "Not assigned",
    className: "bg-muted text-muted-foreground ring-border",
  },
};

export function AiPhoneNumberStatusBadge({ status }: { status: AiPhoneNumberStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        style.className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full bg-current", status === "pending" && "animate-pulse")} />
      {style.label}
    </span>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API blocked (insecure origin / permissions): legacy fallback.
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function emptyMessage(status: AiPhoneNumberStatus, note: string) {
  if (status === "pending") return note || "We're assigning your AI number. This usually takes a moment.";
  return "Turn on the AI receptionist and we'll assign your dedicated number.";
}

/** The provider's virtual AI number (read-only) with status and one-click copy. */
export function AiPhoneNumberDisplay({
  phoneNumber,
  status,
  planActive = true,
  note = "",
}: {
  phoneNumber: string | null;
  status: AiPhoneNumberStatus;
  /** Without the AI Receptionist plan there's no number, only a subscribe prompt. */
  planActive?: boolean;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function onCopy() {
    if (!phoneNumber) return;
    if (await copyText(phoneNumber)) {
      setCopied(true);
      toast.success("AI phone number copied");
    } else {
      toast.error("Could not copy the number");
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        phoneNumber
          ? "border-primary/20 bg-linear-to-br from-primary/[0.06] to-transparent dark:from-primary/15"
          : "border-dashed border-border-soft bg-muted/30 dark:bg-input/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Your AI number</p>
        {planActive ? (
          <AiPhoneNumberStatusBadge status={status} />
        ) : (
          <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground ring-1 ring-border ring-inset">
            No plan
          </span>
        )}
      </div>

      {!planActive ? (
        <div className="mt-3 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm leading-6 text-muted-foreground">
            {note || "AI Receptionist plan not active. Please subscribe to get a dedicated business phone number."}
          </p>
        </div>
      ) : phoneNumber ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2.5 font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.65rem]">
            <PhoneCall className="size-5 text-primary" aria-hidden="true" />
            {formatPhone(phoneNumber)}
          </p>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onCopy}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              status === "pending"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {status === "pending" ? <Clock className="size-4" aria-hidden="true" /> : <PhoneCall className="size-4" aria-hidden="true" />}
          </span>
          <p className="text-sm leading-6 text-muted-foreground">{emptyMessage(status, note)}</p>
        </div>
      )}

      {phoneNumber ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Give this number to customers, or forward your existing business line to it. The AI answers every call.
        </p>
      ) : null}
    </div>
  );
}
