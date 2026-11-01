"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  FileText,
  Loader2,
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

/** The intake fields captured during the sample call, in order. */
const FIELDS = [
  { label: "Caller", value: "Daniel Reyes · (303) 555-0187" },
  { label: "Job", value: "Water heater — no hot water" },
  { label: "Address", value: "1180 Elm St, Denver 80220" },
  { label: "Coverage", value: "Plumbing · inside your service area" },
  { label: "Visit", value: "Thu · 9:00 – 11:00 AM" },
] as const;

/** Steps: 0 ringing → 1..5 fields captured → 6 syncing → 7 booked (then hold and loop). */
const STEP_MS = 1500;
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

/**
 * Pro landing (for-pros-v1): "AI Business Receptionist" — feature rows on the left, a portal-style
 * receptionist preview on the right where a live call's details fill in and sync to the calendar
 * as a booked visit. Loops while on screen; static final state with reduced motion. Illustrative.
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
  const onCall = step > 0 && step < BOOKED - 1;

  return (
    <section className="relative overflow-hidden bg-[#071a33] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 -bottom-48 size-[44rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),transparent_65%)]"
      />
      <Container className="relative grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        {/* Copy + highlights */}
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-5">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative size-2 rounded-full bg-emerald-400" />
              </span>
              AI Business Receptionist
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.85rem] md:leading-[1.08]">
              Never miss a lead. Your 24/7 AI business phone receptionist.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-white/70 md:text-base">
              Every Pro gets a dedicated business number. The AI answers in your company&apos;s name, qualifies the
              homeowner, collects the project details, and books the site visit straight onto your calendar — while
              you&apos;re on the job.
            </p>
          </div>

          <ul className="flex flex-col">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-4 border-t border-white/10 py-4 first:border-t-0 first:pt-0">
                  <Icon className="mt-0.5 size-5 shrink-0 text-sky-300" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">{item.title}</h3>
                    <p className="text-sm leading-6 text-white/65">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="bg-white text-[#071a33] hover:bg-white/90" asChild>
              <Link href={proPaths.register}>
                Get your AI number
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Link href="#plans" className="text-sm font-medium text-sky-200 underline-offset-4 hover:underline">
              See plans with AI minutes
            </Link>
          </div>
        </div>

        {/* Portal-style receptionist preview */}
        <div ref={panelRef} className="min-w-0 lg:pt-6">
          <div className="overflow-hidden rounded-[1.75rem] bg-background text-foreground shadow-[0_50px_100px_-40px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold">AI Receptionist</p>
                <p className="font-mono text-xs text-muted-foreground">(303) 555-0142 · Summit Home Services</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Answering · 24/7
              </span>
            </div>

            {/* Today strip */}
            <dl className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/40 text-center">
              {[
                ["Calls today", booked ? "8" : "7"],
                ["Visits booked", booked ? "4" : "3"],
                ["Missed", "0"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 px-2 py-3">
                  <dt className="order-2 text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="order-1 text-lg font-semibold tabular-nums transition-all duration-500">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Live call */}
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <PhoneIncoming className={cn("size-4 shrink-0", onCall || step === 0 ? "text-emerald-600" : "text-muted-foreground")} aria-hidden="true" />
                  <span className="truncate">{step === 0 ? "Incoming call…" : booked ? "Call ended · 3m 12s" : "Live call · capturing details"}</span>
                </p>
                {onCall ? (
                  <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <span key={bar} className="rs-wave w-[3px] rounded-full bg-emerald-500" style={{ animationDelay: `${bar * 120}ms` }} />
                    ))}
                  </span>
                ) : null}
              </div>

              <ol className="flex flex-col divide-y divide-border rounded-2xl border border-border">
                {FIELDS.map((field, index) => {
                  const done = index < captured;
                  const current = index === captured && onCall;
                  return (
                    <li key={field.label} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                        ) : current ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{field.label}</span>
                      <span
                        className={cn(
                          "min-w-0 truncate text-sm transition-opacity duration-300",
                          done ? "font-medium opacity-100" : "opacity-0",
                        )}
                      >
                        {field.value}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Booking sync */}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-500",
                  booked ? "bg-emerald-500/10" : syncing ? "bg-primary/8" : "bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-500",
                    booked ? "bg-emerald-500 text-white" : "bg-background text-primary ring-1 ring-border",
                  )}
                >
                  {syncing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : booked ? (
                    <CalendarCheck className="size-4" aria-hidden="true" />
                  ) : (
                    <CalendarCheck className="size-4 opacity-50" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {booked ? "Site visit booked · Thu 9:00 AM" : syncing ? "Adding to your Schedule…" : "Waiting for a visit time"}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {booked ? (
                      <>
                        <UserCheck className="size-3.5 shrink-0" aria-hidden="true" />
                        Assigned to Tate R. · water heaters · draft estimate ready
                      </>
                    ) : (
                      "Synced to the calendar when the caller agrees"
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Earlier calls */}
            <div className="border-t border-border px-5 pt-4 pb-5 sm:px-6">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Earlier calls</p>
              <ul className="flex flex-col">
                {RECENT.map((call) => (
                  <li key={call.caller} className="flex items-center gap-3 py-1.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{call.time}</span>
                    <span className="min-w-0 flex-1 truncate">{call.caller}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[call.tone])}>
                      {call.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/45">Illustrative preview of the AI Receptionist in your portal.</p>
        </div>
      </Container>
    </section>
  );
}
