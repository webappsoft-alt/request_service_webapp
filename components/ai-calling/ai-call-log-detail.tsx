"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PortalPage } from "@/components/portal/portal-page";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  // ArrowLeft — was for the removed "All calls" button.
  Bot,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Clock,
  FileText,
  Headphones,
  ListChecks,
  MapPin,
  PhoneForwarded,
  PhoneIncoming,
  Route,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { cn } from "@/lib/utils";
import { AiCallOutcomeBadge, CALL_HISTORY_PATH } from "./ai-call-history";
import {
  EVENT_LABELS,
  callLengthSec,
  callNumberOf,
  formatCallTime,
  isStaleCall,
  type AiCallLog,
  type AiCallOverview,
} from "./call-logs";
import { formatPhone } from "./phone";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAiCallDetail,
  removeAiCall,
  selectAiCallDeletingId,
  selectAiCallDetail,
} from "@/store/aiCallsSlice";

const timeOnly = (value: string) =>
  new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

/** 175 → "2:55" (call-clock style, like the stats bar of the reference). */
function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

const EVENT_TONE: Record<string, string> = {
  lead_created: "bg-emerald-500",
  lead_updated: "bg-emerald-500",
  estimate_drafted: "bg-violet-500",
  estimate_updated: "bg-violet-500",
  assessment_booked: "bg-violet-500",
  transfer: "bg-sky-500",
  out_of_scope: "bg-amber-500",
  error: "bg-destructive",
  interrupted: "bg-amber-400",
};

/** What the receptionist did on the call, as chips (from the activity log). */
function skillChips(call: AiCallLog) {
  const has = (...types: string[]) =>
    call.events.some((event) => types.includes(event.type));
  const aiLines = call.transcript.filter((line) => line.role === "ai").length;
  return [
    aiLines > 1 ? "Answered the caller" : "",
    call.intake ||
    has(
      "lead_created",
      "lead_updated",
      "estimate_drafted",
      "estimate_updated",
      "assessment_booked",
    )
      ? "Took the details"
      : "",
    has("coverage_check") ? "Checked the service area" : "",
    call.intake?.address ? "Confirmed the address" : "",
    call.intake?.issue ? "Captured the scope" : "",
    has("assessment_booked") ? "Scheduled a site visit" : "",
    has("estimate_drafted", "estimate_updated") ? "Drafted an estimate" : "",
    has("lead_created", "lead_updated") ? "Saved a lead" : "",
    has("transfer") ? "Transferred to your team" : "",
  ].filter(Boolean);
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-2xl leading-none font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function distanceStat(overview: AiCallOverview | undefined) {
  const nearest = overview?.distance.nearest;
  if (nearest)
    return {
      value: `${nearest.miles} mi`,
      label: `From an existing ${nearest.kind}`,
    };
  const business = overview?.distance.fromBusinessMiles;
  if (business != null)
    return { value: `${business} mi`, label: "From your business" };
  return { value: "—", label: "Distance" };
}

function CapturedPanel({
  call,
  overview,
}: {
  call: AiCallLog;
  overview: AiCallOverview | undefined;
}) {
  const rows = overview?.captured || [];
  const kind = call.opportunityId
    ? "New estimate"
    : call.leadId
      ? "New lead"
      : "Call details";
  return (
    <section className="rounded-xl border border-border-soft bg-card shadow-xs">
      <header className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {kind}
          </p>
          <h2 className="truncate text-base font-semibold text-foreground">
            {call.customerName || call.serviceName || "Caller"}
          </h2>
        </div>
        <AiCallOutcomeBadge call={call} />
      </header>
      {rows.length ? (
        <dl className="divide-y divide-border-soft">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)_1rem] items-start gap-2 px-4 py-2"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "text-[13px] leading-snug font-medium break-words text-foreground",
                  row.key === "appointment" &&
                    "text-amber-700 dark:text-amber-400",
                )}
              >
                {row.value}
              </dd>
              <Check
                className="mt-0.5 size-3.5 text-emerald-600 dark:text-emerald-400"
                aria-label="Captured"
              />
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No details were captured on this call.
        </p>
      )}
    </section>
  );
}

/** The estimate's site visit status (CrmSiteAssessment.status) as the card shows it. */
const VISIT_STATE: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Site visit scheduled", tone: "text-primary" },
  rescheduled: { label: "Site visit rescheduled", tone: "text-primary" },
  in_progress: {
    label: "Site visit in progress",
    tone: "text-amber-700 dark:text-amber-400",
  },
  completed: {
    label: "Site visit done",
    tone: "text-emerald-700 dark:text-emerald-400",
  },
  cancelled: { label: "Site visit cancelled", tone: "text-destructive" },
  no_show: {
    label: "Customer was not there (no-show)",
    tone: "text-destructive",
  },
};

function BookingCard({
  call,
  overview,
}: {
  call: AiCallLog;
  overview: AiCallOverview;
}) {
  const booking = overview.booking;
  if (!booking) return null;
  // The call created a draft estimate; the visit is its on-site assessment (not a booked job).
  // Status is the visit's own (scheduled / completed / cancelled …), read live from the visit.
  // Previous: an amber "Booked." card.
  const visitState = VISIT_STATE[booking.status] || {
    label: `Site visit ${String(booking.status || "scheduled").replace(/_/g, " ")}`,
    tone: "text-primary",
  };
  return (
    <section className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 dark:bg-primary/10">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
        aria-hidden="true"
      >
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {call.estimateNumber
            ? `Draft estimate ${call.estimateNumber}`
            : "Draft estimate"}
        </p>
        <p className={cn("text-sm font-bold", visitState.tone)}>
          {visitState.label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {booking.label ||
            (booking.scheduledAt
              ? formatCallTime(booking.scheduledAt)
              : "On-site assessment")}
          {booking.estimator ? ` · ${booking.estimator}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          On-site assessment
          {booking.visitNumber ? ` ${booking.visitNumber}` : ""} for this
          estimate, scheduled by the AI receptionist. Add prices and send the
          estimate after the visit.
        </p>
        {call.opportunityId ? (
          <Link
            href={`/pro/dashboard/new-estimate/${call.opportunityId}`}
            className="mt-1.5 inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            Open the estimate
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function RouteCard({ overview }: { overview: AiCallOverview }) {
  const { nearest, fromBusinessMiles } = overview.distance;
  return (
    <section className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-950/20">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-emerald-700 uppercase dark:text-emerald-400">
        <Route className="size-3.5" aria-hidden="true" /> Route-optimized slot
      </p>
      {nearest ? (
        <>
          <p className="mt-1.5 text-sm text-foreground">
            <span className="font-bold">{nearest.miles} mi</span> from{" "}
            {nearest.kind === "job" ? "a job" : "an estimate"} already on the
            calendar
            {nearest.number ? (
              nearest.href ? (
                <>
                  {" "}
                  (
                  <Link
                    href={nearest.href}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {nearest.number}
                  </Link>
                  )
                </>
              ) : (
                ` (${nearest.number})`
              )
            ) : null}
            , so the drive stays short.
          </p>
          <div
            className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"
            aria-hidden="true"
          >
            <span className="size-2.5 shrink-0 rounded-full bg-slate-400" />
            <span className="relative flex-1 border-t-2 border-dashed border-emerald-400/70">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300 bg-background px-1.5 text-[10px] font-semibold text-foreground">
                {nearest.miles} mi
              </span>
            </span>
            <span className="size-2.5 shrink-0 rounded-full bg-amber-500" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Existing {nearest.kind}</span>
            <span>This job</span>
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {fromBusinessMiles != null
            ? "No other estimate or job with a saved location is on the calendar around this time."
            : "The job address couldn't be placed on the map, so no distance is shown."}
        </p>
      )}
      {fromBusinessMiles != null ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" /> {fromBusinessMiles}{" "}
          mi from your business
        </p>
      ) : null}
    </section>
  );
}

/** Estimate, lead and schedule the call created, side by side. */
function LinkedRecords({
  call,
  overview,
}: {
  call: AiCallLog;
  overview: AiCallOverview | undefined;
}) {
  if (!call.leadId && !call.opportunityId && !call.transferredTo) return null;
  return (
    // Right-aligned (client). Previous: "flex flex-wrap gap-2" (left).
    <section className="flex flex-wrap justify-end gap-2">
      {call.opportunityId ? (
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/pro/dashboard/new-estimate/${call.opportunityId}`}>
            <FileText className="size-3.5" aria-hidden="true" />{" "}
            {call.estimateNumber
              ? `Estimate ${call.estimateNumber}`
              : "Open estimate"}
          </Link>
        </Button>
      ) : null}
      {overview?.booking ? (
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href="/pro/dashboard/schedule">
            <CalendarCheck className="size-3.5" aria-hidden="true" /> View on
            schedule
          </Link>
        </Button>
      ) : null}
      {call.leadId ? (
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/pro/dashboard/requests/${call.leadId}`}>
            <ClipboardList className="size-3.5" aria-hidden="true" /> Lead{" "}
            {call.leadNumber}
          </Link>
        </Button>
      ) : null}
      {call.transferredTo ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          <PhoneForwarded className="size-3.5" aria-hidden="true" /> Handed to{" "}
          {formatPhone(call.transferredTo)}
        </span>
      ) : null}
    </section>
  );
}

/** Loading state shaped like the page: stats bar, chat bubbles, captured-details rows, cards. */
function CallDetailSkeleton() {
  const bubbles = [
    { caller: true, width: "w-2/3" },
    { caller: false, width: "w-3/4" },
    { caller: true, width: "w-1/3" },
    { caller: false, width: "w-1/2" },
    { caller: true, width: "w-2/5" },
    { caller: false, width: "w-3/5" },
  ];
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-label="Loading call"
    >
      <section className="rounded-xl border border-border-soft bg-card px-5 py-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-border-soft pb-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
      </section>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="overflow-hidden rounded-xl border border-border-soft bg-card shadow-xs">
          <div className="space-y-2 border-b border-border-soft px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-28 rounded-full" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 bg-muted/20 px-3 py-4">
            {bubbles.map((bubble, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-end gap-1.5",
                  bubble.caller && "flex-row-reverse",
                )}
              >
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className={cn("h-9 rounded-2xl", bubble.width)} />
              </div>
            ))}
          </div>
        </section>
        <div className="flex flex-col gap-3">
          <section className="rounded-xl border border-border-soft bg-card shadow-xs">
            <div className="space-y-2 border-b border-border-soft px-4 py-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="divide-y divide-border-soft">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 px-4 py-2.5"
                >
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-full max-w-44" />
                </div>
              ))}
            </div>
          </section>
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Loading call…</span>
    </div>
  );
}

/** One AI receptionist call: stats, a compact conversation, captured details, booking and route. */
export function AiCallLogDetail({ id }: { id: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  // Cached in the store (aiCallsSlice): reopening a call shows it at once and refreshes in the
  // background. Previous: local state + fetchAiCall on every visit (skeleton each time).
  const entry = useAppSelector((state) => selectAiCallDetail(state, id));
  const call: AiCallLog | null = entry.call;
  // Only an error with nothing to show replaces the page.
  const error = !call && entry.error ? entry.error : "";
  const deletingId = useAppSelector(selectAiCallDeletingId);
  const deleting = deletingId === id;
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void dispatch(fetchAiCallDetail({ id }));
  }, [dispatch, id]);

  // The page header lives here (not in page.tsx) so the call's Estimate / View on schedule / Lead
  // buttons sit on its right, across from "AI Receptionist / Call history".
  const page = (body: ReactNode, actions?: ReactNode) => (
    <PortalPage
      eyebrow="AI Receptionist / Call history"
      title="Call details"
      backHref={CALL_HISTORY_PATH}
      backLabel="Call history"
      actions={actions}
    >
      {body}
    </PortalPage>
  );

  if (error) {
    return page(
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border-soft bg-card px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden="true" /> {error}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={CALL_HISTORY_PATH}>Back to call history</Link>
        </Button>
      </div>,
    );
  }

  // First open only (later visits show the cached call). Previous: three plain grey blocks.
  if (!call) return page(<CallDetailSkeleton />);

  const isTest = call.channel === "browser_test";
  const overview = call.overview;
  const live = call.status === "in_progress" && !isStaleCall(call);
  const distance = distanceStat(overview);
  const chips = skillChips(call);
  const canDelete = call.status !== "in_progress" || isStaleCall(call);
  const callerName =
    call.customerName ||
    (isTest
      ? "Browser test call"
      : call.callerPhone
        ? formatPhone(call.callerPhone)
        : "Unknown caller");

  async function remove() {
    if (!call) return;
    const number = callNumberOf(call);
    const result = await dispatch(removeAiCall({ id: call.id }));
    if (removeAiCall.fulfilled.match(result)) {
      toast.success(`${number} deleted.`);
      router.push(CALL_HISTORY_PATH);
    } else {
      toast.error(result.payload || "Could not delete this call. Try again.");
    }
  }

  return page(
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <section className="rounded-xl border border-border-soft bg-card px-5 py-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                isTest
                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                  : "bg-primary/10 text-primary",
              )}
              aria-hidden="true"
            >
              {isTest ? (
                <Headphones className="size-4" />
              ) : (
                <PhoneIncoming className="size-4" />
              )}
            </span>
            <h2 className="text-base font-semibold text-foreground">
              {callerName}
            </h2>
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {callNumberOf(call)}
            </span>
            <AiCallOutcomeBadge call={call} />
            {isTest ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Test call
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatCallTime(call.startedAt)}</span>
            {call.callerPhone && !isTest ? (
              <span>· {formatPhone(call.callerPhone)}</span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              disabled={!canDelete}
              title={
                canDelete
                  ? "Delete this call record"
                  : "This call is still in progress"
              }
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> Delete
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-3 sm:grid-cols-4">
          <Stat
            value={live ? "Live" : clock(callLengthSec(call))}
            label="Call length"
          />
          <Stat
            value={String(overview?.detailsCaptured ?? 0)}
            label="Details captured"
          />
          <Stat
            value={distance.value}
            label={distance.label}
            hint={overview?.distance.nearest?.number || undefined}
          />
          <Stat value={call.transferredTo ? "1" : "0"} label="Humans needed" />
        </div>
        {overview?.summary ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-[13px] text-foreground">
            <ListChecks
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            {overview.summary}
          </p>
        ) : null}
      </section>

      {/* Linked records moved into the page header (right side). Previous: here, under the stats bar. */}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Compact conversation */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-soft bg-card shadow-xs">
          <header className="border-b border-border-soft px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Conversation
            </p>
            {chips.length ? (
              <ul
                className="mt-2 flex flex-wrap gap-1.5"
                aria-label="What the AI receptionist did"
              >
                {chips.map((chip) => (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/[0.07] px-2 py-0.5 text-[11px] font-medium text-primary dark:bg-primary/15"
                  >
                    <Check className="size-3" aria-hidden="true" /> {chip}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
          <div
            // `relative`: the screen-reader labels (sr-only, position: absolute) stay inside this scroll
            // box. Without it they were placed down the full transcript length outside the box and
            // made the page much taller (empty space under the content).
            className="relative flex max-h-[30rem] flex-col gap-2.5 overflow-y-auto overscroll-contain bg-muted/20 px-3 py-3"
            data-lenis-prevent
          >
            {call.transcript.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing was said on this call.
              </p>
            ) : (
              call.transcript.map((line, index) => {
                const caller = line.role === "caller";
                return (
                  <div
                    key={`${line.at}-${index}`}
                    className={cn(
                      "flex items-end gap-1.5",
                      caller && "flex-row-reverse",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full",
                        caller
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                      aria-hidden="true"
                    >
                      {caller ? (
                        <User className="size-3" />
                      ) : (
                        <Bot className="size-3" />
                      )}
                    </span>
                    <div
                      className={cn(
                        "flex max-w-[78%] flex-col gap-0.5",
                        caller ? "items-end" : "items-start",
                      )}
                    >
                      <p
                        className={cn(
                          "rounded-2xl px-3 py-1.5 text-[13px] leading-snug",
                          caller
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border-soft bg-card text-foreground",
                        )}
                      >
                        <span className="sr-only">
                          {caller ? "Caller: " : "AI receptionist: "}
                        </span>
                        {line.text}
                      </p>
                      <span className="px-1 text-[10px] text-muted-foreground">
                        {caller ? "Caller" : "AI"} · {timeOnly(line.at)}
                        {line.interrupted ? " · interrupted" : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            {live ? (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <CircleDot
                  className="size-3.5 animate-pulse"
                  aria-hidden="true"
                />{" "}
                Call in progress…
              </p>
            ) : null}
          </div>

          {/* Activity log, folded away (the stats and right panel cover it). */}
          <details className="group border-t border-border-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30">
              Activity log ({call.events.length})
              <ChevronDown
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ol className="relative mx-4 mb-4 flex flex-col gap-3 border-l border-border-soft pl-5">
              {call.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card",
                      EVENT_TONE[event.type] || "bg-muted-foreground/50",
                    )}
                    aria-hidden="true"
                  />
                  <p className="text-[13px] font-medium text-foreground">
                    {EVENT_LABELS[event.type] || event.type}
                  </p>
                  {event.detail ? (
                    <p className="mt-0.5 text-xs break-words text-muted-foreground">
                      {event.detail}
                    </p>
                  ) : null}
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />{" "}
                    {timeOnly(event.at)}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </section>

        {/* Captured data + booking + route */}
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-20">
          <CapturedPanel call={call} overview={overview} />
          {overview ? <BookingCard call={call} overview={overview} /> : null}
          {overview &&
          (overview.booking ||
            overview.distance.nearest ||
            overview.distance.fromBusinessMiles != null) ? (
            <RouteCard overview={overview} />
          ) : null}
        </div>
      </div>

      {/* Removed (client): the "All calls" button — the page header's back arrow and the sidebar's
      Call history do the same.
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href={CALL_HISTORY_PATH}>
            <ArrowLeft className="size-3.5" aria-hidden="true" /> All calls
          </Link>
        </Button>
      </div>
      */}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete call record?"
        description={`${callNumberOf(call)} with ${callerName} — the conversation and activity log are removed. Leads, estimates and visits it created stay.`}
        loading={deleting}
        onConfirm={remove}
      />
    </div>,
    <LinkedRecords call={call} overview={overview} />,
  );
}
