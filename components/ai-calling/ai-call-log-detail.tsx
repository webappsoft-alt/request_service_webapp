"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CircleDot,
  ClipboardList,
  Clock,
  FileText,
  Headphones,
  PhoneForwarded,
  PhoneIncoming,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AiCallOutcomeBadge, CALL_HISTORY_PATH } from "./ai-call-history";
import { EVENT_LABELS, fetchAiCall, formatCallDuration, formatCallTime, type AiCallLog } from "./call-logs";
import { formatPhone } from "./phone";

const timeOnly = (value: string) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

const EVENT_TONE: Record<string, string> = {
  lead_created: "bg-emerald-500",
  lead_updated: "bg-emerald-500",
  estimate_drafted: "bg-violet-500",
  estimate_updated: "bg-violet-500",
  transfer: "bg-sky-500",
  out_of_scope: "bg-amber-500",
  error: "bg-destructive",
  interrupted: "bg-amber-400",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Full record of one AI receptionist call: details, transcript, and activity timeline. */
export function AiCallLogDetail({ id }: { id: string }) {
  const [call, setCall] = useState<AiCallLog | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAiCall(id).then(
      (data) => {
        if (!cancelled) setCall(data);
      },
      () => {
        if (!cancelled) setError("This call could not be loaded.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <Card className="rounded-xl border-border-soft">
        <CardContent className="flex flex-col items-start gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" aria-hidden="true" /> {error}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={CALL_HISTORY_PATH}>Back to call history</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!call) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-[32rem] rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const isTest = call.channel === "browser_test";

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-xl border-border-soft">
        <CardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full",
                isTest ? "bg-violet-500/10 text-violet-600 dark:text-violet-300" : "bg-primary/10 text-primary",
              )}
              aria-hidden="true"
            >
              {isTest ? <Headphones className="size-4" /> : <PhoneIncoming className="size-4" />}
            </span>
            <h2 className="text-base font-semibold text-foreground">
              {call.customerName || (isTest ? "Browser test call" : call.callerPhone ? formatPhone(call.callerPhone) : "Unknown caller")}
            </h2>
            <AiCallOutcomeBadge call={call} />
            {isTest ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Test call</span>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Started">{formatCallTime(call.startedAt)}</Fact>
            <Fact label="Duration">{call.status === "in_progress" ? "Live now" : formatCallDuration(call.durationSec)}</Fact>
            <Fact label="Caller ID">{call.callerPhone ? formatPhone(call.callerPhone) : "—"}</Fact>
            <Fact label="Service">{call.serviceName || "—"}</Fact>
            <Fact label="Voice">{call.voiceId ? call.voiceId.charAt(0).toUpperCase() + call.voiceId.slice(1) : "—"}</Fact>
            <Fact label="Transferred to">{call.transferredTo ? formatPhone(call.transferredTo) : "—"}</Fact>
          </dl>
          {call.leadId || call.opportunityId ? (
            <div className="flex flex-wrap gap-2 border-t border-border-soft pt-4">
              {call.leadId ? (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/pro/dashboard/requests/${call.leadId}`}>
                    <ClipboardList className="size-3.5" aria-hidden="true" /> Lead {call.leadNumber}
                  </Link>
                </Button>
              ) : null}
              {call.opportunityId ? (
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={`/pro/dashboard/new-estimate/${call.opportunityId}`}>
                    <FileText className="size-3.5" aria-hidden="true" /> Draft estimate {call.estimateNumber}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="rounded-xl border-border-soft">
          <CardHeader className="border-b border-border-soft">
            <CardTitle>Conversation</CardTitle>
            <CardDescription>Everything the caller and the AI receptionist said, in order.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-4">
            {call.transcript.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing was said on this call.</p>
            ) : (
              call.transcript.map((line, index) => (
                <div key={`${line.at}-${index}`} className={cn("flex items-end gap-2", line.role === "caller" && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      line.role === "caller" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                    )}
                    aria-hidden="true"
                  >
                    {line.role === "caller" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </span>
                  <div className={cn("flex max-w-[80%] flex-col gap-1", line.role === "caller" ? "items-end" : "items-start")}>
                    <p
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        line.role === "caller"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted text-foreground",
                      )}
                    >
                      <span className="sr-only">{line.role === "caller" ? "Caller: " : "AI receptionist: "}</span>
                      {line.text}
                    </p>
                    <span className="px-1 text-[10px] text-muted-foreground">
                      {line.role === "caller" ? "Caller" : "AI"} · {timeOnly(line.at)}
                      {line.interrupted ? " · interrupted by caller" : ""}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border-soft lg:sticky lg:top-20">
          <CardHeader className="border-b border-border-soft">
            <CardTitle>Activity log</CardTitle>
            <CardDescription>What happened during the call.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ol className="relative flex flex-col gap-4 border-l border-border-soft pl-5">
              {call.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card",
                      EVENT_TONE[event.type] || "bg-muted-foreground/50",
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-foreground">{EVENT_LABELS[event.type] || event.type}</p>
                  {event.detail ? <p className="mt-0.5 text-xs break-words text-muted-foreground">{event.detail}</p> : null}
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" /> {timeOnly(event.at)}
                  </p>
                </li>
              ))}
              {call.status === "in_progress" ? (
                <li className="relative text-xs text-primary">
                  <CircleDot className="absolute top-0.5 -left-[27px] size-3.5 animate-pulse" aria-hidden="true" />
                  Call in progress…
                </li>
              ) : null}
            </ol>
            {call.transferredTo ? (
              <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <PhoneForwarded className="size-3.5" aria-hidden="true" /> Handed to {formatPhone(call.transferredTo)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={CALL_HISTORY_PATH}>
            <ArrowLeft className="size-3.5" aria-hidden="true" /> All calls
          </Link>
        </Button>
      </div>
    </div>
  );
}
