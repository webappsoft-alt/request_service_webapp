import Link from "next/link";
import { CalendarClock, ClipboardList, MapPin, PhoneCall, Sparkles, Wrench } from "lucide-react";
import type { ChatCallSummary, ChatRole } from "@/lib/booking/chat-store";

function formatCallTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  if (!seconds || seconds < 1) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest.toString().padStart(2, "0")}s` : `${rest}s`;
}

function Row({ icon: Icon, label, children }: { icon: typeof Wrench; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className="text-sm break-words whitespace-pre-wrap text-foreground">{children}</p>
      </div>
    </li>
  );
}

/**
 * "Call Summary" card the AI receptionist seeds into a chat, so the Pro and the customer
 * share the phone call's context without re-explaining it.
 */
export function CallSummaryCard({ summary, viewer }: { summary: ChatCallSummary; viewer: ChatRole }) {
  const service = [summary.serviceCategory, summary.subService].filter(Boolean).join(" > ");
  const when = formatCallTime(summary.callAt);
  const duration = formatDuration(summary.durationSec);
  const reference = summary.callLogId ? summary.callLogId.slice(-6).toUpperCase() : "";
  const kindLabel = summary.recordKind === "estimate" ? "Estimate request" : "Inquiry";

  return (
    <div className="w-full overflow-hidden rounded-2xl rounded-bl-xs border border-violet-200/80 bg-card shadow-xs dark:border-violet-900/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/70 bg-violet-50/70 px-4 py-2.5 dark:border-violet-900/60 dark:bg-violet-950/30">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-violet-600 text-white">
            <PhoneCall className="size-3.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Call Summary</p>
            <p className="text-[11px] text-muted-foreground">
              {kindLabel}
              {summary.recordNumber ? ` · ${summary.recordNumber}` : ""}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-500/25 ring-inset dark:text-violet-300">
          <Sparkles className="size-3" aria-hidden="true" />
          AI Generated
        </span>
      </div>

      <ul className="space-y-3 px-4 py-3">
        {service ? (
          <Row icon={Wrench} label="Service & sub-service">
            {service}
          </Row>
        ) : null}
        {summary.issue ? (
          <Row icon={ClipboardList} label="Customer reported issue">
            {summary.issue}
            {summary.urgent ? (
              <span className="ml-2 inline-flex rounded-full bg-rose-500/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                Urgent
              </span>
            ) : null}
          </Row>
        ) : null}
        {summary.address || summary.preferredTime ? (
          <Row icon={MapPin} label="Service address & schedule window">
            {[summary.address || "Address not given", summary.preferredTime].filter(Boolean).join("\n")}
          </Row>
        ) : null}
        <Row icon={CalendarClock} label="Call intake">
          {[when, duration].filter(Boolean).join(" · ") || "Phone call"}
          {reference ? <span className="text-muted-foreground"> · Ref {reference}</span> : null}
        </Row>
      </ul>

      {viewer === "provider" && summary.callLogId ? (
        <div className="border-t border-border/70 px-4 py-2">
          <Link
            href={`/pro/dashboard/ai-receptionist/calls/${summary.callLogId}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Open call log & transcript
          </Link>
        </div>
      ) : null}
    </div>
  );
}
