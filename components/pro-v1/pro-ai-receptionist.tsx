"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  MapPin,
  Phone,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/** What the receptionist really does (backend ai-calling intake + technician match + call log). */
const POINTS = [
  "Answers 24/7 on your own business number, in your company's name",
  "Checks the service and your area before it books anything",
  "Books the visit inside your hours with a free, matching technician",
] as const;

/** The call, one line per step. */
const SCRIPT = [
  { who: "ai", text: "Summit Home Services, how can I help?" },
  {
    who: "caller",
    text: "Hi, Daniel Reyes. Our water heater quit last night.",
  },
  { who: "caller", text: "We're at 1180 Elm St, Denver." },
  { who: "ai", text: "That's in our area. Thursday 9 to 11 work for you?" },
  { who: "caller", text: "Thursday at 9 is perfect." },
] as const;

/** Steps: 0 ringing → 1..5 lines → 6 booking → 7 booked (hold, then loop). */
const RING_MS = 1600;
const LINE_MS = 2400;
const BOOKING_MS = 1500;
const HOLD_MS = 4200;
const BOOKING = SCRIPT.length + 1;
const BOOKED = SCRIPT.length + 2;

/** The call log: each step starts working on `startAt` and is done on `doneAt`. */
const ACTIONS = [
  {
    label: "Caller identified",
    detail: "Daniel Reyes · (303) 555-0187",
    startAt: 1,
    doneAt: 2,
  },
  {
    label: "Job captured",
    detail: "Water heater — no hot water",
    startAt: 2,
    doneAt: 3,
  },
  {
    label: "Address verified",
    detail: "1180 Elm St, Denver · in your area",
    startAt: 3,
    doneAt: 4,
  },
  {
    label: "Visit booked",
    detail: "Thu 9:00 – 11:00 AM · Tate R.",
    startAt: 4,
    doneAt: BOOKED,
  },
] as const;

/**
 * Voice bars with deterministic timings, rounded so server and client render identical styles.
 * The envelope tapers the ends so the wave reads as a voice, not a block.
 */
const BARS = Array.from({ length: 44 }, (_, i) => ({
  duration: Math.round((0.55 + ((i * 37) % 9) / 11) * 100) / 100,
  delay: ((i * 53) % 10) / 10,
  cap: Math.round(40 + 60 * Math.sin((Math.PI * (i + 0.5)) / 44)),
}));

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Pro landing (for-pros-v1): "AI Business Receptionist" — copy on the left; on the right a
 * compact frosted-glass live-call widget: caller header with timer, a slim voice waveform, the
 * line being spoken, a horizontal four-step call log (spinner → pulsing green check, the track
 * filling as it goes), and one status line that ends on "Added to your Schedule". CTAs sit under
 * the widget. Loops while on screen; booked end state with reduced motion. Illustrative.
 */
export function ProAiReceptionist() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
      setStep(BOOKED);
      setSeconds(112);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const delay =
      step === 0
        ? RING_MS
        : step === BOOKED
          ? HOLD_MS
          : step === BOOKING
            ? BOOKING_MS
            : LINE_MS;
    const timer = window.setTimeout(() => {
      setTyped(0);
      if (step >= BOOKED) setSeconds(0);
      setStep(step >= BOOKED ? 0 : step + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, step]);

  // Call timer: ticks while the line is open.
  const live = step >= 1 && step <= BOOKING;
  useEffect(() => {
    if (!inView || reducedMotion || !live) return;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [inView, reducedMotion, live]);

  const line = step >= 1 && step <= SCRIPT.length ? SCRIPT[step - 1] : null;
  useEffect(() => {
    if (!line || reducedMotion || typed >= line.text.length) return;
    const timer = window.setTimeout(() => setTyped((count) => count + 2), 26);
    return () => window.clearTimeout(timer);
  }, [line, typed, reducedMotion]);

  const ringing = step === 0;
  const booked = step === BOOKED;
  const caller = line?.who === "caller";
  const doneCount = ACTIONS.filter((action) => step >= action.doneAt).length;
  const lastDone = doneCount > 0 ? ACTIONS[doneCount - 1] : null;

  return (
    <Section
      id="ai-receptionist"
      className="relative scroll-mt-24 overflow-hidden bg-background"
    >
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        {/* Copy */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              AI Business Receptionist
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
              Never miss a lead — even on the job.
            </h2>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
              Your AI receptionist picks up every call, captures the job, and
              books the visit — then leaves the transcript and a draft estimate
              for you to review.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check
                    className="size-3 text-primary"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Live call widget, CTAs underneath */}
        <div className="flex min-w-0 flex-col gap-5">
          <div ref={panelRef} className="relative">
            {/* Ambient brand glow behind the glass */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6"
            >
              <div className="rs-glow absolute -top-4 right-0 size-48 rounded-full bg-primary/20 blur-3xl" />
              <div
                className="rs-glow absolute bottom-0 left-0 size-40 rounded-full bg-sky-400/20 blur-3xl"
                style={{ animationDelay: "-3.5s" }}
              />
            </div>

            <div
              aria-live="polite"
              className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/65 shadow-[0_24px_60px_-34px_rgba(0,63,125,0.45),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-primary/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/4 dark:shadow-[0_24px_60px_-34px_rgba(0,0,0,0.7)]"
            >
              {/* Caller header */}
              <div className="flex items-center gap-3 px-4 pt-4">
                <span className="relative flex size-10 shrink-0 items-center justify-center">
                  {!booked ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 animate-ping rounded-full motion-reduce:hidden",
                        ringing ? "bg-primary/25" : "bg-primary/20",
                      )}
                      style={{ animationDuration: "1.8s" }}
                    />
                  ) : null}
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#01305f] text-xs font-semibold text-primary-foreground">
                    {ringing ? (
                      <Phone className="size-4" aria-hidden="true" />
                    ) : (
                      "DR"
                    )}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        ringing
                          ? "animate-pulse bg-amber-500"
                          : booked
                            ? "bg-primary"
                            : "animate-pulse bg-red-500",
                      )}
                    />
                    <span
                      className={cn(
                        ringing
                          ? "text-amber-600 dark:text-amber-400"
                          : booked
                            ? "text-primary"
                            : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {ringing
                        ? "Incoming call"
                        : booked
                          ? "Call complete"
                          : "Live call active"}
                    </span>
                  </p>
                  <p className="truncate text-[15px] font-semibold tracking-tight">
                    Daniel Reyes
                  </p>
                  <p className="flex items-center gap-x-2.5 truncate text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-2.5" aria-hidden="true" /> (303)
                      555-0187
                    </span>
                    <span className="hidden items-center gap-1 sm:inline-flex">
                      <MapPin className="size-2.5" aria-hidden="true" /> Denver,
                      CO
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Wrench className="size-2.5" aria-hidden="true" /> Water
                      heater
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-md bg-primary/8 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary tabular-nums">
                    {clock(seconds)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Sparkles
                      className="size-2.5 text-primary"
                      aria-hidden="true"
                    />{" "}
                    AI · 24/7
                  </span>
                </div>
              </div>

              {/* Waveform + spoken line */}
              <div className="mx-4 mt-3 rounded-xl bg-primary/5 px-3 py-2.5 ring-1 ring-primary/8 dark:bg-white/4 dark:ring-white/8">
                <div
                  aria-hidden="true"
                  className="flex h-9 items-center gap-0.5"
                >
                  {BARS.map((bar, index) => (
                    <span
                      key={index}
                      className="flex h-full flex-1 items-center justify-center"
                    >
                      <span
                        className={cn(
                          "w-full max-w-0.75 rounded-full transition-colors duration-500",
                          line ? "rs-wave" : "rs-wave-idle",
                          !line
                            ? "bg-muted-foreground/35"
                            : caller
                              ? "bg-primary/60 dark:bg-sky-300/70"
                              : "bg-primary dark:bg-sky-300",
                        )}
                        style={{
                          animationDuration: `${line ? bar.duration : bar.duration * 2}s`,
                          animationDelay: `${bar.delay}s`,
                          maxHeight: `${bar.cap}%`,
                        }}
                      />
                    </span>
                  ))}
                </div>
                <p
                  key={step}
                  className="animate-in fade-in mt-1.5 truncate text-[13px] leading-5 duration-300"
                >
                  {line ? (
                    <>
                      <span
                        className={cn(
                          "mr-1 font-semibold",
                          caller ? "text-primary" : "text-primary",
                        )}
                      >
                        {caller ? "Daniel:" : "AI:"}
                      </span>
                      {reducedMotion ? line.text : line.text.slice(0, typed)}
                      {!reducedMotion && typed < line.text.length ? (
                        <span
                          aria-hidden="true"
                          className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-current align-middle"
                        />
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {ringing
                        ? "Answering on the first ring…"
                        : booked
                          ? "Transcript saved to the lead."
                          : "Confirming the visit…"}
                    </span>
                  )}
                </p>
              </div>

              {/* Call log: horizontal stepper */}
              <ol className="relative mx-4 mt-4 grid grid-cols-4">
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 right-[12.5%] left-[12.5%] h-px bg-border"
                />
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 left-[12.5%] h-px bg-primary transition-[width] duration-700 ease-out"
                  style={{
                    width: `${(Math.max(0, doneCount - 1) / (ACTIONS.length - 1)) * 75}%`,
                  }}
                />
                {ACTIONS.map((action, index) => {
                  const state: StepState =
                    step >= action.doneAt
                      ? "done"
                      : step >= action.startAt
                        ? "working"
                        : "queued";
                  const isBooking = index === ACTIONS.length - 1;
                  return (
                    <li
                      key={action.label}
                      className="relative flex flex-col items-center gap-1.5 px-1 text-center"
                    >
                      <StepNode state={state} waiting={isBooking} />
                      <span
                        className={cn(
                          "text-[11px] leading-tight transition-colors duration-300",
                          state === "queued"
                            ? "text-muted-foreground"
                            : "font-semibold text-foreground",
                        )}
                      >
                        {action.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          state === "done"
                            ? "text-primary"
                            : state === "working"
                              ? "text-primary"
                              : "text-muted-foreground/70",
                        )}
                      >
                        {state === "done"
                          ? isBooking
                            ? "Confirmed"
                            : "Done"
                          : state === "working"
                            ? isBooking
                              ? "Confirming…"
                              : "Working…"
                            : isBooking
                              ? "Waiting"
                              : "Queued"}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Status line: latest result, then the booking */}
              <div
                className={cn(
                  "mt-4 flex h-11 items-center gap-2.5 border-t px-4 text-xs transition-colors duration-500",
                  booked
                    ? "border-primary/15 bg-primary/6"
                    : "border-primary/8 dark:border-white/8",
                )}
              >
                {booked ? (
                  <>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <CalendarCheck className="size-3.5" aria-hidden="true" />
                    </span>
                    <span
                      key="booked"
                      className="animate-in fade-in slide-in-from-bottom-1 min-w-0 truncate duration-500"
                    >
                      <span className="font-semibold">
                        Added to your Schedule
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · Thu 9–11 AM · Tate R. · customer notified
                      </span>
                    </span>
                  </>
                ) : (
                  <span
                    key={lastDone?.label ?? "none"}
                    className="animate-in fade-in min-w-0 truncate text-muted-foreground duration-500"
                  >
                    {lastDone ? (
                      <>
                        <span className="font-medium text-foreground">
                          {lastDone.label}
                        </span>{" "}
                        · {lastDone.detail}
                      </>
                    ) : (
                      "Call log updates as the AI works…"
                    )}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">
                  {doneCount}/{ACTIONS.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href={proPaths.register}>
                Get your AI number
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="#plans">See plans</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}

type StepState = "queued" | "working" | "done";

/** Stepper node: hollow (clock while waiting) → spinning ring → green check with a soft pulse. */
function StepNode({ state, waiting }: { state: StepState; waiting: boolean }) {
  if (state === "done") {
    return (
      <span className="rs-check-pulse relative z-10 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check
          className="animate-in zoom-in-50 size-3.5 duration-300"
          strokeWidth={3.5}
          aria-hidden="true"
        />
      </span>
    );
  }
  if (state === "working") {
    return (
      <span className="relative z-10 flex size-7 items-center justify-center rounded-full bg-background">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary motion-reduce:animate-none" />
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
      {waiting ? (
        <Clock3 className="size-3" aria-hidden="true" />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      )}
    </span>
  );
}
