"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Check,
  FileText,
  Loader2,
  Phone,
  PhoneIncoming,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/** What the receptionist really does (backend ai-calling intake + technician match + call log). */
const HIGHLIGHTS = [
  {
    icon: PhoneIncoming,
    title: "Your own business number",
    body: "Answered in your company's name, day or night. Forward your current line to it.",
  },
  {
    icon: ShieldCheck,
    title: "Qualifies before it books",
    body: "Checks the service and your area, and hands urgent calls to you.",
  },
  {
    icon: CalendarCheck,
    title: "Books inside your hours",
    body: "Visits land on your Schedule with a free technician whose skills fit.",
  },
  {
    icon: FileText,
    title: "Every call on file",
    body: "Transcript, details, and a draft estimate — nothing is sent until you review it.",
  },
] as const;

const GREETING = "Thanks for calling Summit Home Services — how can I help?";

/** The intake fields captured during the sample call, in order, with the line that captured each. */
const FIELDS = [
  { label: "Caller", value: "Daniel Reyes · (303) 555-0187", who: "caller", said: "Hi, this is Daniel Reyes." },
  { label: "Job", value: "Water heater — no hot water", who: "caller", said: "Our water heater quit — no hot water since last night." },
  { label: "Address", value: "1180 Elm St, Denver 80220", who: "caller", said: "We're at 1180 Elm St in Denver." },
  { label: "Coverage", value: "Plumbing · in your area", who: "ai", said: "Good news — that's inside our plumbing service area." },
  { label: "Visit", value: "Thu · 9:00 – 11:00 AM", who: "ai", said: "A technician can come Thursday, 9 to 11. Shall I book it?" },
] as const;

/** Steps: 0 ringing → 1..5 fields captured → 6 syncing → 7 booked (then hold and loop). */
const STEP_MS = 1700;
const SYNC_MS = 1600;
const HOLD_MS = 4200;
const BOOKED = FIELDS.length + 2;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Pro landing (for-pros-v1): "AI Business Receptionist" — a heading row, four short highlights,
 * and one compact card where a live call's transcript fills the lead details until the visit is
 * booked. Loops while on screen; static final state with reduced motion. Illustrative.
 */
export function ProAiReceptionist() {
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
      setStep(BOOKED);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const delay = step === BOOKED ? HOLD_MS : step === BOOKED - 1 ? SYNC_MS : STEP_MS;
    const timer = window.setTimeout(() => setStep((current) => (current >= BOOKED ? 0 : current + 1)), delay);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, step]);

  const captured = Math.min(step, FIELDS.length);
  const syncing = step === BOOKED - 1;
  const booked = step === BOOKED;
  const ringing = step === 0;
  const onCall = step > 0 && step < BOOKED - 1;

  // Greeting, then the line behind each captured field; the card shows the latest two.
  const lines = step > 0 ? [{ who: "ai", said: GREETING }, ...FIELDS.slice(0, captured)] : [];
  const visibleLines = lines.slice(-2);

  return (
    <Section id="ai-receptionist" className="relative scroll-mt-24 bg-background">
      <Container className="flex flex-col gap-10">
        {/* Heading row */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
          <div className="flex flex-col gap-3">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              AI Business Receptionist
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
              Never miss a lead. Your 24/7 AI phone receptionist.
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              A dedicated business number that answers in your company&apos;s name, qualifies the homeowner, and books the
              site visit onto your calendar — while you&apos;re on the job.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button asChild>
                <Link href={proPaths.register}>
                  Get your AI number
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Link href="#plans" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                See plans with AI minutes
              </Link>
            </div>
          </div>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
          {/* Highlights */}
          <ul className="grid gap-3 sm:grid-cols-2">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-[13px] leading-5 text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>

          {/* Compact live-call card */}
          <div ref={panelRef} className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_60px_-36px_rgba(15,23,42,0.3)]">
              {/* Line */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                <p className="flex min-w-0 items-center gap-2 text-xs">
                  <Phone className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">
                    <span className="font-mono font-semibold tabular-nums">(303) 555-0142</span>
                    <span className="text-muted-foreground"> · Summit Home Services</span>
                  </span>
                </p>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Answering 24/7
                </span>
              </div>

              <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border" aria-live="polite">
                {/* Call */}
                <div className="flex min-w-0 flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex size-9 shrink-0 items-center justify-center">
                      {!syncing && !booked ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-0 rounded-full motion-reduce:animate-none",
                            ringing ? "animate-ping bg-primary/20" : "animate-pulse bg-emerald-500/15",
                          )}
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative flex size-9 items-center justify-center rounded-full text-xs font-semibold",
                          syncing || booked ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                        )}
                      >
                        {step > 0 ? "DR" : <PhoneIncoming className="size-4" aria-hidden="true" />}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{step > 0 ? "Daniel Reyes" : "Incoming call"}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                        {onCall ? (
                          <>
                            <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
                              {[0, 1, 2, 3].map((bar) => (
                                <span key={bar} className="rs-wave w-0.5 rounded-full bg-emerald-500" style={{ animationDelay: `${bar * 120}ms` }} />
                              ))}
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-300">AI on the line · {clock(8 + captured * 36)}</span>
                          </>
                        ) : ringing ? (
                          "Ringing…"
                        ) : (
                          "Call ended · 3:12"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Latest two lines of the transcript */}
                  <ol className="flex min-h-26 flex-col justify-end gap-1.5">
                    {visibleLines.map((line) => (
                      <li
                        key={line.said}
                        className={cn(
                          "animate-in fade-in slide-in-from-bottom-1 max-w-[92%] rounded-xl px-2.5 py-1.5 text-xs leading-snug duration-300",
                          line.who === "ai"
                            ? "self-start rounded-bl-sm bg-muted text-foreground"
                            : "self-end rounded-br-sm bg-primary text-primary-foreground",
                        )}
                      >
                        {line.who === "ai" ? (
                          <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-primary">
                            <Bot className="size-3" aria-hidden="true" /> AI receptionist
                          </span>
                        ) : null}
                        {line.said}
                      </li>
                    ))}
                    {ringing ? <li className="self-center text-[11px] text-muted-foreground">Answered on the first ring</li> : null}
                  </ol>
                </div>

                {/* Lead */}
                <div className="flex min-w-0 flex-col border-t border-border p-4 sm:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">New lead</p>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {captured}/{FIELDS.length}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(captured / FIELDS.length) * 100}%` }} />
                  </div>
                  <dl className="mt-2.5 flex flex-col gap-1.5">
                    {FIELDS.map((field, index) => {
                      const done = index < captured;
                      const current = index === captured && onCall;
                      return (
                        <div key={field.label} className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "flex size-3.5 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                              done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {done ? (
                              <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                            ) : current ? (
                              <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
                            ) : null}
                          </span>
                          <dt className="w-14 shrink-0 text-muted-foreground">{field.label}</dt>
                          <dd className="min-w-0 flex-1 truncate font-medium">
                            {done ? (
                              <span className="animate-in fade-in duration-300">{field.value}</span>
                            ) : (
                              <span className={cn("block h-1.5 w-20 rounded-full bg-muted", current && "animate-pulse")} aria-hidden="true" />
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </div>

              {/* Booking + today */}
              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-2.5 transition-colors duration-500",
                  booked ? "bg-emerald-500/8" : "bg-muted/40",
                )}
              >
                <p className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                  {syncing ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <CalendarCheck className={cn("size-3.5 shrink-0", booked ? "text-emerald-600" : "text-muted-foreground")} aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {booked ? "Visit booked · Thu 9:00 AM" : syncing ? "Adding to your Schedule…" : "Waiting for a visit time"}
                  </span>
                  {booked ? (
                    <span className="hidden items-center gap-1 font-normal text-muted-foreground sm:inline-flex">
                      <UserCheck className="size-3" aria-hidden="true" /> Tate R.
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Today: <span className="font-semibold text-foreground">{booked ? 8 : 7}</span> calls ·{" "}
                  <span className="font-semibold text-foreground">{booked ? 4 : 3}</span> booked ·{" "}
                  <span className="font-semibold text-foreground">0</span> missed
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Illustrative preview of the AI Receptionist in your portal.</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
