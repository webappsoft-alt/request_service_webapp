"use client";

import { useEffect, useRef, useState } from "react";
import {
  BellRing,
  Briefcase,
  CalendarCheck,
  Columns3,
  FileText,
  Inbox,
  Radio,
  Receipt,
  Search,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/** The real board's five columns (backend crm/pipeline/board.js) and what a drop there does. */
const STAGES = [
  {
    column: "Leads",
    icon: Inbox,
    title: "A lead comes in",
    body: "From your profile, a booking, or the AI receptionist — it lands in New leads.",
    card: { id: "REQ-517", status: "New", meta: "Water heater · AI call", tone: "bg-sky-50 text-sky-700" },
    event: "New lead from the AI receptionist",
  },
  {
    column: "Estimates",
    icon: FileText,
    title: "Drop it on Estimates",
    body: "A draft estimate opens from the lead — no retyping. It shows in your Estimates tab at once.",
    card: { id: "EST-883", status: "Sent", meta: "$2,140.00 · draft → sent", tone: "bg-violet-50 text-violet-700" },
    event: "Estimate EST-883 created from the lead",
  },
  {
    column: "Scheduled jobs",
    icon: CalendarCheck,
    title: "Book the job",
    body: "Pick the day, the time, and the technician. The job lands on the Schedule and the customer is notified.",
    card: { id: "JOB-351", status: "Booked", meta: "Thu 9:00 AM · Tate R.", tone: "bg-emerald-50 text-emerald-700" },
    event: "Job booked · customer notified",
  },
  {
    column: "Jobs in progress",
    icon: Briefcase,
    title: "Work starts",
    body: "The technician clocks in on site and the card moves itself; stages show as they're done.",
    card: { id: "JOB-351", status: "In-progress", meta: "Tate R. clocked in · 1h 12m", tone: "bg-amber-50 text-amber-700" },
    event: "Tate R. clocked in on JOB-351",
  },
  {
    column: "Invoices",
    icon: Receipt,
    title: "Bill and get paid",
    body: "Invoice from the job and track the balance until it's settled.",
    card: { id: "INV-1051", status: "Paid", meta: "$2,140.00 · card", tone: "bg-emerald-50 text-emerald-700" },
    event: "INV-1051 paid in full",
  },
] as const;

/** Other cards already on the board (samples), per column. */
const BACKGROUND = [
  [
    { id: "REQ-512", who: "Priya Patel" },
    { id: "REQ-498", who: "Owen Brooks" },
  ],
  [{ id: "EST-879", who: "Grace Thompson" }],
  [{ id: "JOB-342", who: "Marcus Johnson" }],
  [
    { id: "JOB-333", who: "Huraira Customer" },
    { id: "JOB-338", who: "Grace Thompson" },
  ],
  [{ id: "INV-1045", who: "Owen Brooks" }],
] as const;

const COUNTS = [8, 5, 4, 3, 6];
const STEP_MS = 2600;

/**
 * Pro landing (for-pros-v1): the Pipeline — centered heading, then the five stages on the left
 * (clickable) beside a clean board where one customer's card moves column to column on its own,
 * with the matching stage lit and a live "what just happened" line. Pauses off screen and once a
 * stage is picked; static on the booking step with reduced motion.
 */
export function ProPipelineSection() {
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [auto, setAuto] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAuto(false);
      setStep(2);
      return;
    }
    const node = boardRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView) return;
    const timer = window.setTimeout(() => setStep((current) => (current + 1) % STAGES.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [auto, inView, step]);

  const stage = STAGES[step];

  return (
    <Section id="pipeline" className="relative scroll-mt-24 bg-background">
      <Container className="relative flex flex-col gap-10 lg:gap-14">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Columns3 className="size-3.5" aria-hidden="true" />
            Pipeline
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
            Every lead, estimate, job, and invoice on one board.
          </h2>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
            See where every dollar is stuck. Drag a card to the next stage and the real record moves with it — live for
            everyone in the office.
          </p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-12">
          {/* Stages */}
          <ol className="flex flex-col gap-1.5">
            {STAGES.map((item, index) => {
              const Icon = item.icon;
              const on = index === step;
              const done = index < step;
              return (
                <li key={item.column}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setAuto(false);
                      setStep(index);
                    }}
                    className={cn(
                      "flex w-full gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-border bg-background shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]"
                        : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                        on ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold tracking-tight">{item.title}</span>
                        <span className="text-[11px] text-muted-foreground">{item.column}</span>
                      </span>
                      {on ? (
                        <span className="animate-in fade-in mt-1 block text-sm leading-6 text-muted-foreground duration-300">{item.body}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Board */}
          <div ref={boardRef} className="min-w-0">
            <div
              role="img"
              data-light
              aria-label={`Pipeline board: Daniel Reyes's card is in ${stage.column} — ${stage.event}`}
              className="overflow-hidden rounded-[1.5rem] border border-border bg-muted/30 p-3 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)] sm:p-4"
            >
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400 dark:border-white/10 dark:bg-white/5">
                <Search className="size-3.5" aria-hidden="true" />
                Search customer, EST-883, JOB-351, or status…
              </div>

              <div className="mt-3 overflow-x-auto [scrollbar-width:none]">
                <div className="grid min-w-[36rem] grid-cols-5 gap-2">
                  {STAGES.map((column, index) => {
                    const here = index === step;
                    return (
                      <div
                        key={column.column}
                        className={cn(
                          "flex min-h-64 flex-col gap-1.5 rounded-xl p-1.5 transition-colors duration-500",
                          here ? "bg-primary/8 ring-1 ring-primary/20" : "bg-slate-100/80 dark:bg-white/5",
                        )}
                      >
                        <p className="flex items-center justify-between gap-1 px-1 pt-0.5 text-[10px] font-semibold">
                          <span className="truncate">{column.column}</span>
                          <span className="rounded-full bg-white px-1.5 text-[9px] text-slate-500 tabular-nums dark:bg-white/10">
                            {COUNTS[index] + (here ? 1 : 0)}
                          </span>
                        </p>

                        {here ? (
                          <div
                            key={`${step}-card`}
                            className="animate-in fade-in zoom-in-95 slide-in-from-left-4 rounded-lg border border-primary/30 bg-white p-2 text-slate-900 shadow-[0_12px_24px_-12px_rgba(2,16,36,0.45)] duration-500"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-semibold text-primary">{column.card.id}</span>
                              <span className={cn("rounded-full px-1.5 py-px text-[8px] font-semibold whitespace-nowrap", column.card.tone)}>
                                {column.card.status}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] font-semibold">Daniel Reyes</p>
                            <p className="truncate text-[9px] text-slate-500">{column.card.meta}</p>
                          </div>
                        ) : null}

                        {BACKGROUND[index].map((card) => (
                          <div key={card.id} className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[9px] font-semibold text-slate-400">{card.id}</p>
                            <p className="truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">{card.who}</p>
                            <span className="mt-1.5 block h-1.5 w-3/4 rounded-full bg-slate-100 dark:bg-white/10" />
                          </div>
                        ))}

                        <p className="mt-auto px-1 pb-0.5 text-center text-[9px] font-medium text-slate-400">See more</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What just happened */}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5">
                <p key={step} className="animate-in fade-in slide-in-from-bottom-1 flex min-w-0 items-center gap-2 text-xs duration-300">
                  <BellRing className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{stage.event}</span>
                </p>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <Radio className="size-3.5" aria-hidden="true" />
                  Live for the office
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
