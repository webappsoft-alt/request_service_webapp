// sliceHttp (lazy) — not apiFuntions: this file is used by store/aiCallsSlice, and apiFuntions
// imports the store (circular init: "Cannot access default export before initialization").
// Previous: import { deleteData, getData } from "@/components/api/apiFuntions";
import { deleteData, getData } from "@/components/api/sliceHttp";

/** apiFuntions.getData's generic signature (sliceHttp forwards to it). */
type SliceGet = typeof import("@/components/api/apiFuntions").getData;
import { AI_CALLING_ENDPOINT } from "./api";

export type AiCallChannel = "phone" | "browser_test";
export type AiCallOutcome =
  | "lead_captured"
  | "transferred"
  | "ended_by_ai"
  | "caller_hung_up"
  | "no_response"
  | "out_of_scope"
  | "error"
  | "";

export type AiCallTranscriptLine = {
  role: "caller" | "ai";
  text: string;
  interrupted?: boolean;
  at: string;
};

export type AiCallEvent = { type: string; detail: string; at: string };

export type AiCallSummary = {
  id: string;
  callId: string;
  channel: AiCallChannel;
  callerPhone: string;
  voiceId: string;
  status: "in_progress" | "completed";
  outcome: AiCallOutcome;
  endReason: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  customerName: string;
  serviceName: string;
  leadId: string | null;
  leadNumber: string;
  opportunityId: string | null;
  estimateNumber: string;
  /** "estimate" | "lead": what the intake was saved as (empty on older calls). */
  intakeKind?: string;
  transferredTo: string;
  turns?: number;
  preview?: string;
  /** Display number (CALL-1A2B3C), from the server. */
  callNumber?: string;
  /** One line: what the AI did on the call. */
  summary?: string;
};

export type AiCallCapturedField = { key: string; label: string; value: string };

/** Detail page: captured details, the visit booked and how far the job is (GET /calls/:id). */
export type AiCallOverview = {
  callNumber: string;
  summary: string;
  captured: AiCallCapturedField[];
  detailsCaptured: number;
  booking: {
    label: string;
    scheduledAt: string | null;
    durationMinutes: number | null;
    visitNumber: string;
    estimator: string;
    status: string;
  } | null;
  distance: {
    fromBusinessMiles: number | null;
    nearest: {
      miles: number;
      kind: string;
      number: string;
      title: string;
      date: string;
      startMinutes: number;
      href: string;
    } | null;
  };
};

export type AiCallLog = AiCallSummary & {
  transcript: AiCallTranscriptLine[];
  events: AiCallEvent[];
  /** What the caller gave the AI (saved with the lead / estimate). */
  intake?: {
    serviceCategory?: string;
    subService?: string;
    issue?: string;
    address?: string;
    preferredTime?: string;
    urgent?: boolean;
    email?: string;
    recordNumber?: string;
  } | null;
  overview?: AiCallOverview;
};

/** Display number for a call (same rule as the server): CALL-1A2B3C. */
export function callNumberOf(call: Pick<AiCallSummary, "id" | "callNumber">) {
  return call.callNumber || `CALL-${String(call.id || "").slice(-6).toUpperCase()}`;
}

/** Still marked in progress hours after it started: the connection dropped without ending the call. */
export function isStaleCall(call: Pick<AiCallSummary, "status" | "startedAt">) {
  return call.status === "in_progress" && Date.now() - new Date(call.startedAt).getTime() > 2 * 3600_000;
}

/** Call length in seconds: the stored duration, else (dropped / running call) up to its last line or event. */
export function callLengthSec(call: AiCallLog) {
  if (call.status === "completed") return call.durationSec || 0;
  const times = [...call.transcript.map((line) => line.at), ...call.events.map((event) => event.at)]
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  const last = times.length ? Math.max(...times) : new Date(call.startedAt).getTime();
  return Math.max(0, Math.round((last - new Date(call.startedAt).getTime()) / 1000));
}

export function deleteAiCall(id: string) {
  return deleteData(`${AI_CALLING_ENDPOINT}/calls/${id}`, { silent: true });
}

export type AiCallListResponse = {
  data: AiCallSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export function fetchAiCalls(params: {
  page?: number;
  limit?: number;
  channel?: AiCallChannel | "";
  /** Only the calls that created / updated this estimate (opportunity). */
  opportunityId?: string;
  /** Customer, phone, service, lead / estimate number or call number. */
  search?: string;
  outcome?: string;
}) {
  return (getData as SliceGet)<AiCallListResponse>(
    `${AI_CALLING_ENDPOINT}/calls`,
    {
      page: params.page || 1,
      limit: params.limit || 20,
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.opportunityId ? { opportunityId: params.opportunityId } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      ...(params.outcome ? { outcome: params.outcome } : {}),
    },
    { silent: true, force: true },
  );
}

export async function fetchAiCall(id: string) {
  const res = await (getData as SliceGet)<{ data: AiCallLog }>(`${AI_CALLING_ENDPOINT}/calls/${id}`, undefined, {
    silent: true,
    force: true,
  });
  return res.data;
}

export const OUTCOME_META: Record<string, { label: string; className: string }> = {
  lead_captured: {
    label: "Estimate drafted",
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400",
  },
  lead_saved: {
    label: "Lead captured",
    className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400",
  },
  transferred: { label: "Transferred", className: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-400" },
  ended_by_ai: { label: "Completed", className: "bg-muted text-muted-foreground ring-border" },
  caller_hung_up: { label: "Caller hung up", className: "bg-muted text-muted-foreground ring-border" },
  no_response: { label: "No response", className: "bg-muted text-muted-foreground ring-border" },
  out_of_scope: {
    label: "Out of scope",
    className: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400",
  },
  error: { label: "Error", className: "bg-destructive/10 text-destructive ring-destructive/25" },
  in_progress: { label: "In progress", className: "bg-primary/10 text-primary ring-primary/25" },
};

export function outcomeMeta(
  call: Pick<AiCallSummary, "status" | "outcome"> & Partial<Pick<AiCallSummary, "intakeKind" | "leadNumber" | "estimateNumber">>,
) {
  if (call.status === "in_progress") return OUTCOME_META.in_progress;
  // A saved intake is either a lead or a draft estimate; label it by what was created.
  const savedLead = call.intakeKind ? call.intakeKind === "lead" : Boolean(call.leadNumber && !call.estimateNumber);
  if (call.outcome === "lead_captured" && savedLead) return OUTCOME_META.lead_saved;
  return OUTCOME_META[call.outcome] || OUTCOME_META.ended_by_ai;
}

export const EVENT_LABELS: Record<string, string> = {
  call_started: "Call started",
  interrupted: "Caller interrupted the AI",
  ignored_noise: "Background noise ignored",
  out_of_scope: "Out-of-scope request",
  coverage_check: "Service area checked",
  email_invalid: "Unclear email, asked again",
  outside_hours: "Requested time outside working hours, asked again",
  lead_created: "Lead created",
  lead_updated: "Existing lead updated",
  estimate_drafted: "Draft estimate created",
  estimate_updated: "Draft estimate updated",
  assessment_booked: "On-site assessment booked",
  transfer: "Transferred to a person",
  ended_by_ai: "AI ended the call",
  silence_check: "Caller went quiet, AI checked in",
  silence_hangup: "Ended after no response",
  error: "Error",
  call_ended: "Call ended",
};

export function formatCallDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds || 0));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function formatCallTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
