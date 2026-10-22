"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { getData } from "@/components/api/sliceHttp";
import { DateStamp } from "@/components/portal/dashboard-widgets";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CALL_HISTORY_PATH } from "./ai-call-history";
import { AI_CALLING_ENDPOINT } from "./api";

type ActivityList<T> = { total: number; items: T[] };

export type AiCallActivity = {
  upcomingAssessments: ActivityList<{
    id: string;
    number: string;
    scheduledAt: string;
    title: string;
    customerName: string;
    href: string;
  }>;
  newLeads: ActivityList<{
    id: string;
    number: string;
    serviceName: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    href: string;
  }>;
  draftEstimates: ActivityList<{
    id: string;
    number: string;
    title: string;
    type: string;
    createdAt: string;
    customerName: string;
    href: string;
  }>;
};

const EMPTY: AiCallActivity = {
  upcomingAssessments: { total: 0, items: [] },
  newLeads: { total: 0, items: [] },
  draftEstimates: { total: 0, items: [] },
};

/** Realtime events that can change what the AI receptionist has booked or captured. */
const REFRESH_EVENTS = new Set(["LEAD_CREATED", "LEAD_UPDATED", "ESTIMATE_CREATED", "ESTIMATE_UPDATED", "ESTIMATE_SENT"]);

export async function fetchAiCallActivity(): Promise<AiCallActivity> {
  const response = (await getData(`${AI_CALLING_ENDPOINT}/activity`, undefined, {
    silent: true,
    force: true,
  })) as { data?: Partial<AiCallActivity> } | undefined;
  const data = response?.data ?? {};
  return {
    upcomingAssessments: data.upcomingAssessments ?? EMPTY.upcomingAssessments,
    newLeads: data.newLeads ?? EMPTY.newLeads,
    draftEstimates: data.draftEstimates ?? EMPTY.draftEstimates,
  };
}

function visitTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Column({
  title,
  count,
  href,
  empty,
  children,
}: {
  title: string;
  count: number;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <Link
        href={href}
        className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2 transition-colors hover:text-primary"
      >
        <span className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{title}</span>
        <span className={cn("text-lg font-semibold tabular-nums", count > 0 && "text-primary")}>{count}</span>
      </Link>
      {count === 0 ? (
        <p className="px-4 pb-4 text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-input/60 border-t border-input/60">{children}</div>
      )}
    </div>
  );
}

/**
 * Pro dashboard: what the AI receptionist booked or captured. Nothing here was sent to the
 * caller; drafts wait for the Pro to review and send.
 */
export function AiCallActivityCard() {
  const [activity, setActivity] = useState<AiCallActivity | null>(null);

  const load = useCallback(async () => {
    try {
      setActivity(await fetchAiCallActivity());
    } catch {
      setActivity((current) => current ?? EMPTY);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type && REFRESH_EVENTS.has(type)) void load();
    };
    window.addEventListener("rs-realtime", onRealtime);
    return () => window.removeEventListener("rs-realtime", onRealtime);
  }, [load]);

  const data = activity ?? EMPTY;
  const { upcomingAssessments, newLeads, draftEstimates } = data;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-input/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        !activity && "opacity-60",
      )}
      aria-busy={!activity}
    >
      <div className="flex items-center justify-between gap-3 border-b border-input/70 px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
          <Bot className="size-4 text-violet-600" aria-hidden="true" />
          AI Call Activity
        </h2>
        <Link
          href={CALL_HISTORY_PATH}
          className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          Call history
        </Link>
      </div>
      <div className="grid divide-y divide-input/60 md:grid-cols-3 md:divide-x md:divide-y-0">
        <Column
          title="Upcoming AI assessments"
          count={upcomingAssessments.total}
          href="/pro/dashboard/schedule"
          empty="No visits booked by the AI yet."
        >
          {upcomingAssessments.items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
            >
              <DateStamp value={item.scheduledAt} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{item.customerName || item.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {visitTime(item.scheduledAt)} · {item.title}
                </p>
              </div>
            </Link>
          ))}
        </Column>
        <Column
          title="New AI leads"
          count={newLeads.total}
          href="/pro/dashboard/requests"
          empty="No new call inquiries."
        >
          {newLeads.items.map((item) => (
            <Link key={item.id} href={item.href} className="block px-4 py-2.5 transition-colors hover:bg-muted/40">
              <p className="truncate text-[13px] font-medium">
                {item.customerName || "Caller"}
                <span className="font-normal text-muted-foreground"> · {item.serviceName || item.number}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {item.number} · {formatDate(item.createdAt)}
              </p>
            </Link>
          ))}
        </Column>
        <Column
          title="Draft estimates"
          count={draftEstimates.total}
          href="/pro/dashboard/new-estimate"
          empty="No AI drafts waiting for review."
        >
          {draftEstimates.items.map((item) => (
            <Link key={item.id} href={item.href} className="block px-4 py-2.5 transition-colors hover:bg-muted/40">
              <p className="truncate text-[13px] font-medium">
                {item.number}
                <span className="font-normal text-muted-foreground"> · {item.customerName || item.title}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {item.type === "site_assessment" ? "Site assessment · add scope after the visit" : item.title} ·
                Review &amp; send
              </p>
            </Link>
          ))}
        </Column>
      </div>
    </section>
  );
}
