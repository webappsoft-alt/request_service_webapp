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
  PhoneForwarded,
  PhoneIncoming,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/** What the receptionist really does (backend ai-calling intake + technician match + call log). */
const HIGHLIGHTS = [
  {
    icon: PhoneIncoming,
    title: "Your own business number",
    body: "Calls are answered in your company's name, day or night. Keep your current number and forward it to your AI number after hours or when the line is busy.",
  },
  {
    icon: ShieldCheck,
    title: "Qualifies before it books",
    body: "Checks the job is a service you offer, in an area you cover — and politely turns away the rest.",
  },
  {
    icon: CalendarCheck,
    title: "Books inside your hours",
    body: "Site visits land on your Schedule with the technician whose skills fit and who is free at that time.",
  },
  {
    icon: PhoneForwarded,
    title: "Hands off when it should",
    body: "Emergencies, upset callers, or anyone asking for a person are transferred to the number you choose.",
  },
  {
    icon: FileText,
    title: "Every call on file",
    body: "Transcript, captured details, and the draft estimate or lead — nothing goes to the customer until you review it.",
  },
] as const;

const GREETING = "Thanks for calling Summit Home Services — how can I help?";

/** The intake fields captured during the sample call, in order, with the line that captured each. */
const FIELDS = [
  { label: "Caller", value: "Daniel Reyes · (303) 555-0187", who: "caller", said: "Hi, this is Daniel Reyes." },
  { label: "Job", value: "Water heater — no hot water", who: "caller", said: "Our water heater quit — no hot water since last night." },
  { label: "Address", value: "1180 Elm St, Denver 80220", who: "caller", said: "We're at 1180 Elm St in Denver." },
  { label: "Coverage", value: "Plumbing · inside your area", who: "ai", said: "Good news — that's inside our plumbing service area." },
  { label: "Visit", value: "Thu · 9:00 – 11:00 AM", who: "ai", said: "A technician can come Thursday, 9 to 11. Shall I book it?" },
] as const;

/** Steps: 0 ringing → 1..5 fields captured → 6 syncing → 7 booked (then hold and loop). */
const STEP_MS = 1700;
const SYNC_MS = 1600;
const HOLD_MS = 4200;
const BOOKED = FIELDS.length + 2;

const RECENT = [
  { time: "8:42 AM", caller: "Priya Patel", outcome: "Draft estimate", tone: "sky" },
  { time: "7:15 AM", caller: "Grace Thompson", outcome: "Visit booked", tone: "emerald" },
  { time: "11:58 PM", caller: "Blue Spruce Bakery", outcome: "Lead saved", tone: "amber" },
] as const;

const TONES = {
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Pro landing (for-pros-v1): "AI Business Receptionist" — feature rows on the left; on the right a
 * glass console with the dedicated number, a live call screen with its transcript, the lead card
 * filling in beside it until the visit is booked, and today's call log. Loops while on screen;
 * static final state with reduced motion. Illustrative.
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
  const ended = syncing || booked;

  // Greeting, then the line behind each captured field; the call screen shows the latest three.
  const lines = step > 0 ? [{ who: "ai", said: GREETING }, ...FIELDS.slice(0, captured)] : [];
  const visibleLines = lines.slice(-3);

  return (
    <section className="relative bg-background">
      <Container className="relative grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        {/* Copy + highlights */}
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative size-2 rounded-full bg-emerald-400" />
              </span>
              AI Business Receptionist
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.85rem] md:leading-[1.08]">
              Never miss a lead. Your 24/7 AI business phone receptionist.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Every Pro gets a dedicated business number. The AI answers in your company&apos;s name, qualifies the
              homeowner, collects the project details, and books the site visit straight onto your calendar — while
              you&apos;re on the job.
            </p>
          </div>

          <ul className="flex flex-col">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-4 border-t border-border py-4 first:border-t-0 first:pt-0">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" asChild>
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

        {/* Receptionist console */}
        <div ref={panelRef} className="min-w-0 lg:pt-4">
          <div className="rounded-[1.75rem] border border-border bg-muted/40 p-2.5 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)] sm:p-3">
            {/* Dedicated number */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2.5 pt-1.5 pb-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Phone className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Your AI business line</p>
                  <p className="truncate font-mono text-sm font-semibold tabular-nums">(303) 555-0142</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Answering · 24/7
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3" aria-live="polite">
              {/* Call screen */}
              <div className="flex min-h-88 min-w-0 flex-col rounded-2xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col items-center gap-2.5 pt-2 text-center">
                  <span className="relative flex size-14 items-center justify-center">
                    {!ended ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-0 rounded-full",
                          ringing ? "animate-ping bg-primary/20" : "animate-pulse bg-emerald-500/15",
                        )}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative flex size-14 items-center justify-center rounded-full text-base font-semibold transition-colors duration-500",
                        ended ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                      )}
                    >
                      {step > 0 ? "DR" : <PhoneIncoming className="size-5" aria-hidden="true" />}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{step > 0 ? "Daniel Reyes" : "Incoming call"}</p>
                    <p className="font-mono text-[11px] text-muted-foreground tabular-nums">(303) 555-0187 · Denver, CO</p>
                  </div>
                  <div className="flex h-5 items-center gap-2 text-[11px] font-medium">
                    {onCall ? (
                      <>
                        <span aria-hidden="true" className="flex h-3.5 items-end gap-0.75">
                          {[0, 1, 2, 3, 4].map((bar) => (
                            <span key={bar} className="rs-wave w-0.75 rounded-full bg-emerald-500" style={{ animationDelay: `${bar * 120}ms` }} />
                          ))}
                        </span>
                        <span className="text-emerald-700 tabular-nums dark:text-emerald-300">AI on the line · {clock(8 + captured * 36)}</span>
                      </>
                    ) : ringing ? (
                      <span className="text-primary">Ringing…</span>
                    ) : (
                      <span className="text-muted-foreground">Call ended · 3:12</span>
                    )}
                  </div>
                </div>

                {/* Transcript */}
                <ol className="mt-4 flex flex-1 flex-col justify-end gap-2">
                  {visibleLines.map((line) => (
                    <li
                      key={line.said}
                      className={cn(
                        "animate-in fade-in slide-in-from-bottom-1 max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-snug duration-300",
                        line.who === "ai"
                          ? "self-start rounded-bl-md bg-muted text-foreground"
                          : "self-end rounded-br-md bg-primary text-primary-foreground",
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

              {/* Lead card */}
              <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-background p-4 text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">New lead</p>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {captured}/{FIELDS.length} captured
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${(captured / FIELDS.length) * 100}%` }}
                  />
                </div>

                <dl className="mt-3 flex flex-1 flex-col">
                  {FIELDS.map((field, index) => {
                    const done = index < captured;
                    const current = index === captured && onCall;
                    return (
                      <div key={field.label} className="flex items-start gap-2.5 border-t border-border py-2 first:border-t-0">
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {done ? (
                            <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                          ) : current ? (
                            <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <dt className="text-[11px] text-muted-foreground">{field.label}</dt>
                          <dd className="min-h-5 text-[13px]">
                            {done ? (
                              <span className="animate-in fade-in block truncate font-medium duration-300">{field.value}</span>
                            ) : (
                              <span
                                className={cn("mt-1.5 block h-2 w-24 rounded-full bg-muted", current && "animate-pulse")}
                                aria-hidden="true"
                              />
                            )}
                          </dd>
                        </div>
                      </div>
                    );
                  })}
                </dl>

                {/* Booking sync */}
                <div
                  className={cn(
                    "mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-500",
                    booked ? "bg-emerald-500/10" : syncing ? "bg-primary/8" : "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-500",
                      booked ? "bg-emerald-500 text-white" : "bg-background text-primary ring-1 ring-border",
                    )}
                  >
                    {syncing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CalendarCheck className={cn("size-4", !booked && "opacity-50")} aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {booked ? "Visit booked · Thu 9:00 AM" : syncing ? "Adding to your Schedule…" : "Waiting for a visit time"}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      {booked ? (
                        <>
                          <UserCheck className="size-3 shrink-0" aria-hidden="true" />
                          Tate R. · draft estimate ready
                        </>
                      ) : (
                        "Synced when the caller agrees"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Today + call log */}
            <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-3">
              <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-3 sm:grid-cols-1 sm:gap-2.5 sm:px-5">
                {[
                  ["Calls today", booked ? "8" : "7"],
                  ["Visits booked", booked ? "4" : "3"],
                  ["Missed", "0"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col items-center sm:flex-row sm:items-baseline sm:gap-2">
                    <dd className="text-lg font-semibold tabular-nums sm:w-5">{value}</dd>
                    <dt className="text-[11px] whitespace-nowrap text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
              <div className="min-w-0 rounded-2xl border border-border bg-background px-4 py-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Call log</p>
                <ul className="flex flex-col">
                  {RECENT.map((call) => (
                    <li key={call.caller} className="flex items-center gap-3 py-1 text-sm">
                      <span className="w-15 shrink-0 text-[11px] text-muted-foreground tabular-nums">{call.time}</span>
                      <span className="min-w-0 flex-1 truncate">{call.caller}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[call.tone])}>
                        {call.outcome}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Illustrative preview of the AI Receptionist in your portal.</p>
        </div>
      </Container>
    </section>
  );
}
