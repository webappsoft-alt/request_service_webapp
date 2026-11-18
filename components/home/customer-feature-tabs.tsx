"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Camera,
  Check,
  CreditCard,
  FilePlus2,
  Home,
  Image as ImageIcon,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Navigation,
  Receipt,
  Send,
  ShieldCheck,
  Star,
  Wrench,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/**
 * Home page (customer side): "Your customer dashboard" — replaces the before/after kitchen section.
 * Tabs = the customer panel's sections (/account sidebar order). Each tab has its OWN animated
 * scene, built like the Pro landing's visuals (components/pro-v1/pro-dashboard-mocks.tsx): floating
 * cards spread over the whole stage, a phone, a map, a signature, a printed receipt… — sized with
 * container queries so secondary pieces drop out on phones. Sample data only.
 * Previous versions: (1) one centred card per tab (too much empty space), (2) every tab inside the
 * same mock panel frame (all tabs looked alike). The Invoices scene is the one from version 1
 * (client: "payment tab previous is ok").
 */

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const FLOAT_CARD =
  "rounded-2xl border border-border/70 bg-background shadow-[0_16px_40px_-24px_rgba(0,63,125,0.4)]";
const FIRST_STEP_MS = 250;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const cents = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (value: number) => String(Math.round(value));

/** Advances 0 → steps - 1 and loops while on screen. Shows the end state with reduced motion. */
function useLoopStep(steps: number, stepMs: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reducedMotion()) {
      const frame = requestAnimationFrame(() => setStep(steps - 1));
      return () => cancelAnimationFrame(frame);
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [steps]);

  useEffect(() => {
    if (!inView) return;
    const advance = () => setStep((value) => (value + 1) % steps);
    let interval = 0;
    const first = window.setTimeout(() => {
      advance();
      interval = window.setInterval(advance, stepMs);
    }, FIRST_STEP_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [inView, steps, stepMs]);

  return { ref, step };
}

/** A number easing to `value` (writes to the DOM, no re-render per frame). */
function CountUp({ value, format = whole, ms = 900 }: { value: number; format?: (value: number) => string; ms?: number }) {
  const node = useRef<HTMLSpanElement>(null);
  const current = useRef(value);
  const [initial] = useState(() => format(value));
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    if (reducedMotion()) {
      current.current = value;
      element.textContent = format(value);
      return;
    }
    const start = current.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / ms);
      current.current = start + (value - start) * (1 - (1 - progress) ** 3);
      element.textContent = format(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, format, ms]);
  return (
    <span ref={node} className="tabular-nums">
      {initial}
    </span>
  );
}

function Stage({ rootRef, className, children }: { rootRef: React.Ref<HTMLDivElement>; className?: string; children: ReactNode }) {
  return (
    <div ref={rootRef} className={cn("relative size-full", className)}>
      {children}
    </div>
  );
}

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

function PhoneFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border-[6px] border-[#0b1a2e] bg-background shadow-[0_30px_60px_-24px_rgba(2,16,36,0.6)]",
        className,
      )}
    >
      <span aria-hidden="true" className="absolute top-1.5 left-1/2 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-[#0b1a2e]" />
      {children}
    </div>
  );
}

function Chip({ tone = "blue", children }: { tone?: "blue" | "green" | "amber" | "slate"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        tone === "blue" && "bg-primary/10 text-primary",
        tone === "green" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
        tone === "amber" && "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        tone === "slate" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/* ───────────────────────── 1. Overview: the home screen ───────────────────────── */

const OV_FRAMES = [
  { requests: 1, estimates: 1, orders: 1, due: 1240, done: 0 },
  { requests: 1, estimates: 3, orders: 2, due: 1240, done: 1 },
  { requests: 2, estimates: 3, orders: 3, due: 422.93, done: 2 },
  { requests: 2, estimates: 2, orders: 4, due: 0, done: 3 },
] as const;
const OV_PROJECTS = [
  { title: "Water heater replacement", meta: "JOB-381 · Master Plumbers", from: "Scheduled", to: "Completed" },
  { title: "Kitchen outlet repair", meta: "EST-693 · Bright Electric", from: "To review", to: "Approved" },
  { title: "Roof leak inspection", meta: "REQ-643 · 3 estimates in", from: "Waiting", to: "Booked" },
  { title: "Drain cleaning", meta: "ORD-207 · fixed price", from: "Paid", to: "Paid" },
] as const;
const OV_NOTES = [
  "Master Plumbers sent EST-584",
  "Mike R. is on the way · 12 min",
  "INV-559 paid · receipt saved",
  "New message from Bright Electric",
] as const;
const OV_ACTIONS = [
  { label: "Request a quote", icon: FilePlus2 },
  { label: "Message a pro", icon: MessageCircle },
  { label: "Pay an invoice", icon: CreditCard },
  { label: "Track my pro", icon: Navigation },
] as const;
const OV_MS = 1800;

function OverviewVisual() {
  const { ref, step } = useLoopStep(OV_FRAMES.length, OV_MS);
  const frame = OV_FRAMES[step];
  const stats = [
    { label: "Quote requests", value: frame.requests, format: whole },
    { label: "Estimates", value: frame.estimates, format: whole },
    { label: "Orders", value: frame.orders, format: whole, wide: true },
    { label: "Balance due", value: frame.due, format: dollars, wide: true },
  ];
  const notes = [OV_NOTES[step], OV_NOTES[(step + 3) % OV_NOTES.length]];
  return (
    <Stage rootRef={ref} className="flex flex-col gap-2.5 p-3 @md:p-4">
      <div className="grid shrink-0 grid-cols-2 gap-2.5 @md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={cn(FLOAT_CARD, "px-3 py-2.5", stat.wide && "hidden @md:block")}>
            <p className="truncate text-[11px] text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-semibold tracking-tight">
              <CountUp value={stat.value} format={stat.format} />
            </p>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-2.5 @md:grid-cols-[1.25fr_1fr]">
        <div className={cn(FLOAT_CARD, "flex min-h-0 flex-col overflow-hidden")}>
          <p className="shrink-0 border-b px-3 py-2 text-xs font-semibold">Active projects</p>
          <ul className="grid min-h-0 flex-1 auto-rows-fr divide-y">
            {OV_PROJECTS.map((project, index) => {
              const moved = index < frame.done;
              return (
                <li key={project.title} className="flex items-center gap-2 px-3 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{project.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{project.meta}</p>
                  </div>
                  <Chip tone={moved ? "green" : index === 2 ? "amber" : "blue"}>
                    {moved ? (
                      <>
                        <Check className="size-3" aria-hidden="true" /> {project.to}
                      </>
                    ) : (
                      project.from
                    )}
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="hidden min-h-0 flex-col gap-2.5 @md:flex">
          <div className={cn(FLOAT_CARD, "shrink-0 p-3")}>
            <p className="text-xs font-semibold">Quick actions</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {OV_ACTIONS.map(({ label, icon: Icon }, index) => (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors duration-500",
                    index === step ? "border-primary bg-primary/8 text-primary" : "border-border",
                  )}
                >
                  <Icon className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={cn(FLOAT_CARD, "min-h-0 flex-1 overflow-hidden p-3")}>
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Bell className="size-3.5 text-primary" aria-hidden="true" />
              Notifications
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {notes.map((note, index) => (
                <li
                  key={note}
                  className={cn(
                    "truncate rounded-lg px-2 py-1.5 text-[11px]",
                    index === 0 ? "animate-in fade-in slide-in-from-top-2 bg-primary/8 font-medium duration-500" : "text-muted-foreground",
                  )}
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/* ───────────────────────── 2. Quote requests: one form → pros reply ───────────────────────── */

const QR_DETAILS = "Water heater leaking from the bottom, about 10 years old.";
const QR_PROS = [
  { name: "Master Plumbers", rating: 4.9, price: 1240, eta: "Thu" },
  { name: "FlowRight Plumbing", rating: 4.8, price: 1385, eta: "Fri" },
  { name: "Apex Home Services", rating: 4.7, price: 1190, eta: "Mon" },
] as const;
const QR_STEPS = 7;
const QR_MS = 1100;

function QuoteRequestsVisual() {
  const { ref, step } = useLoopStep(QR_STEPS, QR_MS);
  const typed = QR_DETAILS.slice(0, Math.round((Math.min(step, 2) / 2) * QR_DETAILS.length));
  const sent = step >= 3;
  const arrived = Math.max(0, step - 3);
  return (
    <Stage rootRef={ref} className="grid gap-3 p-3 @md:grid-cols-[1fr_1.1fr] @md:p-5">
      <div className={cn(FLOAT_CARD, "flex flex-col gap-2.5 p-4")}>
        <p className="text-xs font-semibold">New quote request</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground">Service</p>
            <p className="truncate text-xs font-medium">Plumbing</p>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <p className="text-[10px] text-muted-foreground">ZIP Code</p>
            <p className="text-xs font-medium">80205</p>
          </div>
        </div>
        <div className="min-h-20 rounded-lg border px-2.5 py-1.5">
          <p className="text-[10px] text-muted-foreground">What&apos;s going on?</p>
          <p className="text-xs leading-5">
            {typed}
            {!sent ? <span className="ml-px inline-block h-3 w-px animate-pulse bg-foreground align-middle" /> : null}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1].map((index) => (
            <span
              key={index}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-opacity duration-500",
                step >= 2 ? "opacity-100" : "opacity-0",
              )}
            >
              <Camera className="size-4" aria-hidden="true" />
            </span>
          ))}
        </div>
        <span
          className={cn(
            "mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all duration-300",
            sent ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
            step === 2 && "scale-95 ring-4 ring-primary/25",
          )}
        >
          {sent ? (
            <>
              <Check className="size-3.5" aria-hidden="true" /> Sent to 3 local pros
            </>
          ) : (
            <>
              <Send className="size-3.5" aria-hidden="true" /> Send request
            </>
          )}
        </span>
      </div>
      <div className="hidden flex-col justify-center gap-2.5 @md:flex">
        <p className="text-xs font-semibold text-muted-foreground">
          Estimates received · <span className="text-foreground tabular-nums">{arrived}</span> of 3
        </p>
        {QR_PROS.map((pro, index) => {
          const show = index < arrived;
          const best = show && arrived === 3 && pro.price === 1190;
          return (
            <div
              key={pro.name}
              className={cn(
                FLOAT_CARD,
                "flex items-center gap-3 p-3 transition-all duration-500",
                EASE,
                show ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
                best && "ring-2 ring-primary/40",
              )}
            >
              <Initials name={pro.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{pro.name}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                  {pro.rating} · can start {pro.eta}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{dollars(pro.price)}</p>
                {best ? <p className="text-[10px] font-semibold text-primary">Lowest</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

/* ───────────────────────── 3. Estimates: read, sign, approved ───────────────────────── */

const EST_LINES = [
  { label: "50-gal gas water heater", amount: 980 },
  { label: "Labor & installation", amount: 210 },
  { label: "Haul away old unit", amount: 50 },
] as const;
const EST_STEPS = 7;
const EST_MS = 1000;

function EstimatesVisual() {
  const { ref, step } = useLoopStep(EST_STEPS, EST_MS);
  const shown = Math.min(step, EST_LINES.length);
  const total = EST_LINES.slice(0, shown).reduce((sum, line) => sum + line.amount, 0);
  const signing = step >= 4;
  const approved = step >= 6;
  return (
    <Stage rootRef={ref} className="flex items-center justify-center p-3 @md:p-6">
      <div className={cn(FLOAT_CARD, "relative w-full max-w-lg overflow-hidden @md:mr-24")}>
        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Estimate EST-584</p>
            <p className="truncate text-[11px] text-muted-foreground">Master Plumbers · licensed &amp; insured</p>
          </div>
          <BadgeCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        </div>
        <ul className="divide-y px-4">
          {EST_LINES.map((line, index) => (
            <li
              key={line.label}
              className={cn(
                "flex items-center justify-between py-2.5 text-sm transition-all duration-500",
                index < shown ? "opacity-100" : "opacity-0",
              )}
            >
              <span>{line.label}</span>
              <span className="font-medium tabular-nums">{dollars(line.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold">
            <CountUp value={total} format={dollars} />
          </span>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-5 bottom-14 -rotate-12 rounded-md border-2 border-emerald-600 px-2 py-0.5 text-sm font-bold tracking-widest text-emerald-600 uppercase transition-all duration-500",
            approved ? "scale-100 opacity-100" : "scale-150 opacity-0",
          )}
        >
          Approved
        </span>
      </div>
      {/* Signature card, floating over the estimate's corner. */}
      <div
        className={cn(
          FLOAT_CARD,
          "absolute right-3 bottom-3 w-52 p-3 transition-all duration-500 @md:right-6 @md:bottom-8",
          EASE,
          signing ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <p className="text-[11px] font-semibold text-muted-foreground">Sign to approve</p>
        <svg viewBox="0 0 200 50" className="mt-1 h-10 w-full" aria-hidden="true">
          <path
            d="M6 34 C 20 6, 30 46, 44 24 S 66 10, 74 30 S 98 44, 108 22 S 132 8, 140 28 S 168 40, 194 18"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={step >= 5 ? 0 : 1}
            className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <div className="mt-1 border-t pt-1.5 text-[10px] text-muted-foreground">Sarah Johnson · Nov 18</div>
        <span
          className={cn(
            "mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors duration-300",
            approved ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {approved ? (
            <>
              <Check className="size-3" aria-hidden="true" /> Job booked
            </>
          ) : (
            "Approve estimate"
          )}
        </span>
      </div>
    </Stage>
  );
}

/* ───────────────────────── 4. Orders: live map + change order ───────────────────────── */

const ROUTE = [
  [10, 80],
  [26, 70],
  [38, 54],
  [55, 50],
  [68, 34],
  [80, 24],
] as const;
const ETAS = ["15 min", "12 min", "8 min", "5 min", "2 min", "Arrived"] as const;
const ORDER_STAGES = ["Scheduled", "On the way", "On site", "Completed"] as const;
const ORDER_MS = 1200;
const ORDER_STEPS = ROUTE.length + 2;

function OrdersVisual() {
  const { ref, step } = useLoopStep(ORDER_STEPS, ORDER_MS);
  const point = Math.min(step, ROUTE.length - 1);
  const [x, y] = ROUTE[point];
  const arrived = point === ROUTE.length - 1;
  const stage = step === 0 ? 0 : arrived ? (step >= ORDER_STEPS - 1 ? 3 : 2) : 1;
  const [homeX, homeY] = ROUTE[ROUTE.length - 1];
  const path = ROUTE.map(([px, py], index) => `${index ? "L" : "M"}${px} ${py}`).join(" ");
  const changeOrder = step >= ROUTE.length;
  return (
    <Stage rootRef={ref} className="overflow-hidden">
      {/* Map fills the stage. */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_31px,color-mix(in_srgb,var(--primary)_7%,transparent)_32px),linear-gradient(90deg,transparent_31px,color-mix(in_srgb,var(--primary)_7%,transparent)_32px)] bg-size-[32px_32px]" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <path d="M0 62 L100 40" fill="none" strokeWidth="10" className="stroke-background" vectorEffect="non-scaling-stroke" />
        <path d="M30 0 L48 100" fill="none" strokeWidth="10" className="stroke-background" vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" className="stroke-primary/50" vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        className="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-8 ring-emerald-500/15"
        style={{ left: `${homeX}%`, top: `${homeY}%` }}
      >
        <Home className="size-4" aria-hidden="true" />
      </span>
      <span
        className={cn(
          "absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-1000",
          EASE,
          arrived && "scale-0 opacity-0",
        )}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <Navigation className="size-4" aria-hidden="true" />
      </span>

      {/* Order card (bottom-left). */}
      <div className={cn(FLOAT_CARD, "absolute right-3 bottom-3 left-3 p-3 @md:right-auto @md:w-80")}>
        <div className="flex items-center gap-3">
          <Initials name="Mike Ross" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">JOB-381 · Water heater</p>
            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {stage === 0 ? "Mike R. · Thu 9–11 AM" : stage === 1 ? "Mike R. is on the way" : "Mike R. checked in at your home"}
            </p>
          </div>
          <Chip tone={stage >= 2 ? "green" : "blue"}>{stage === 1 ? `ETA ${ETAS[point]}` : ORDER_STAGES[stage]}</Chip>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1">
          {ORDER_STAGES.map((label, index) => (
            <div key={label} className="flex flex-col gap-1">
              <span className={cn("h-1.5 rounded-full transition-colors duration-500", index <= stage ? "bg-primary" : "bg-muted")} />
              <span className={cn("truncate text-[10px]", index <= stage ? "font-medium" : "text-muted-foreground")}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change order (top-right) once the tech is on site. */}
      <div
        className={cn(
          FLOAT_CARD,
          "absolute top-3 right-3 hidden w-64 overflow-hidden transition-all duration-500 @md:block",
          EASE,
          changeOrder ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
        )}
      >
        <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 dark:bg-amber-500/10">
          <Wrench className="size-3.5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">Change order · needs your OK</span>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Corroded shut-off valve</span>
            <span className="font-semibold">+$95</span>
          </div>
          <span
            className={cn(
              "mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors duration-300",
              step >= ORDER_STEPS - 1 ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {step >= ORDER_STEPS - 1 ? (
              <>
                <Check className="size-3" aria-hidden="true" /> Approved
              </>
            ) : (
              "Approve"
            )}
          </span>
        </div>
      </div>
    </Stage>
  );
}

/* ───────────────────────── 5. Invoices (kept from the first version) ───────────────────────── */

const INV_MS = 1300;
const INV_STEPS = 5;

function InvoicesVisual() {
  const { ref, step } = useLoopStep(INV_STEPS, INV_MS);
  const paying = step === 3;
  const paid = step >= 4;
  return (
    <Stage rootRef={ref} className="flex items-center justify-center p-5 @md:p-8">
      <div className={cn(FLOAT_CARD, "relative w-full max-w-md overflow-hidden")}>
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Invoice INV-559</p>
            <p className="text-xs text-muted-foreground">Due Nov 20 · Master Plumbers</p>
          </div>
          <Receipt className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div className="flex flex-col divide-y px-4 text-sm">
          <div className="flex justify-between py-2.5">
            <span>Estimate EST-584</span>
            <span className="tabular-nums">{dollars(1240)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span>Approved change order</span>
            <span className="tabular-nums">{dollars(95)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-muted-foreground">
            <span>Deposit paid</span>
            <span className="tabular-nums">−{cents(912.07)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">Balance due</span>
          <span className="text-lg font-semibold tabular-nums">{cents(paid ? 0 : 422.93)}</span>
        </div>
        <div className="border-t px-4 py-3">
          <div
            className={cn(
              "mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-300",
              step >= 1 ? "opacity-100" : "opacity-0",
              step >= 2 ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <CreditCard className="size-4 text-primary" aria-hidden="true" />
            Visa •• 4242
            {step >= 2 ? <Check className="ml-auto size-4 text-primary" aria-hidden="true" /> : null}
          </div>
          <div
            className={cn(
              "flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition-all duration-300",
              paid ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground",
              paying && "scale-95 ring-4 ring-primary/25",
            )}
          >
            {paid ? "Paid — receipt sent" : paying ? "Processing…" : `Pay ${cents(422.93)}`}
          </div>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-14 right-5 -rotate-12 rounded-md border-2 border-emerald-600 px-2 py-0.5 text-sm font-bold tracking-widest text-emerald-600 uppercase transition-all duration-500",
            paid ? "scale-100 opacity-100" : "scale-150 opacity-0",
          )}
        >
          Paid
        </span>
      </div>
    </Stage>
  );
}

/* ───────────────────────── 6. Payments: history chart + printed receipt ───────────────────────── */

const PAY_MONTHS = [
  { month: "Jul", amount: 149 },
  { month: "Aug", amount: 0 },
  { month: "Sep", amount: 320 },
  { month: "Oct", amount: 334 },
  { month: "Nov", amount: 1335 },
] as const;
const PAY_HISTORY = [
  { label: "INV-559 · final balance", method: "Visa •• 4242", amount: 422.93 },
  { label: "JOB-381 · deposit", method: "Visa •• 4242", amount: 912.07 },
  { label: "INV-512 · outlet repair", method: "ACH •• 0911", amount: 185 },
] as const;
const PAY_STEPS = 6;
const PAY_MS = 1100;
const PAY_MAX = 1335;

function PaymentsVisual() {
  const { ref, step } = useLoopStep(PAY_STEPS, PAY_MS);
  const grown = step >= 1;
  const rows = Math.max(0, Math.min(PAY_HISTORY.length, step - 1));
  const printed = step >= 4;
  const total = PAY_MONTHS.reduce((sum, item) => sum + item.amount, 0);
  return (
    <Stage rootRef={ref} className="grid gap-3 p-3 @md:grid-cols-[1.35fr_1fr] @md:p-5">
      <div className="flex min-h-0 flex-col gap-3">
        <div className={cn(FLOAT_CARD, "p-3")}>
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold">Paid this year</p>
            <p className="text-lg font-semibold">
              <CountUp value={grown ? total : 0} format={dollars} />
            </p>
          </div>
          <div className="mt-3 flex h-24 items-end gap-2">
            {PAY_MONTHS.map((item, index) => (
              <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <span
                    className={cn("w-full rounded-t-md transition-[height] duration-1000", EASE, index === 4 ? "bg-primary" : "bg-primary/30")}
                    style={{ height: grown ? `${Math.max(4, (item.amount / PAY_MAX) * 100)}%` : "4%", transitionDelay: `${index * 90}ms` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{item.month}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={cn(FLOAT_CARD, "min-h-0 flex-1 overflow-hidden")}>
          <p className="border-b px-3 py-2 text-xs font-semibold">Payment history</p>
          <ul className="divide-y">
            {PAY_HISTORY.map((item, index) => (
              <li
                key={item.label}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 transition-all duration-500",
                  index < rows ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{item.method}</span>
                </span>
                <span className="text-xs font-semibold tabular-nums">{cents(item.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Receipt printing out of the top. */}
      <div className="relative hidden overflow-hidden @md:block">
        <div
          className={cn(
            "rs-receipt absolute inset-x-2 top-0 bg-background px-4 pt-4 pb-6 shadow-[0_16px_40px_-24px_rgba(0,63,125,0.4)] transition-transform duration-1000",
            EASE,
            printed ? "translate-y-0" : "-translate-y-full",
          )}
        >
          <p className="text-center text-xs font-semibold">Payment receipt</p>
          <p className="text-center text-[10px] text-muted-foreground">Master Plumbers · Nov 18</p>
          <div className="my-3 border-t border-dashed" />
          <div className="flex justify-between text-[11px]">
            <span>INV-559</span>
            <span className="tabular-nums">{cents(422.93)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Visa •• 4242</span>
            <span>Approved</span>
          </div>
          <div className="my-3 border-t border-dashed" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Paid</span>
            <span className="tabular-nums">{cents(422.93)}</span>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-emerald-600">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Saved to your account
          </p>
        </div>
        <div className="absolute inset-x-0 top-0 h-2 rounded-full bg-[#0b1a2e]/80" aria-hidden="true" />
      </div>
    </Stage>
  );
}

/* ───────────────────────── 7. Messages: phone chat + notifications ───────────────────────── */

const CHAT = [
  { from: "pro", text: "Hi Sarah, I can come Thursday 9–11 AM." },
  { from: "me", text: "Perfect. Here's the leak:", photo: true },
  { from: "pro", text: "Thanks — I'll bring the right valve." },
  { from: "me", text: "Great, see you Thursday!" },
] as const;
const CHAT_STEPS = CHAT.length + 2;
const CHAT_MS = 1200;
const TOASTS = [
  { icon: MessageCircle, title: "Master Plumbers", body: "I can come Thursday 9–11 AM." },
  { icon: CalendarClock, title: "Visit confirmed", body: "Thu, Nov 20 · 9–11 AM" },
  { icon: Navigation, title: "Mike R. is on the way", body: "Arriving in about 12 minutes" },
] as const;

function MessagesVisual() {
  const { ref, step } = useLoopStep(CHAT_STEPS, CHAT_MS);
  const toastCount = Math.min(TOASTS.length, Math.max(0, step - 1));
  return (
    <Stage rootRef={ref} className="flex items-center justify-center gap-6 p-3 @md:justify-start @md:pl-[10%]">
      <PhoneFrame className="h-[23rem] w-56 shrink-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b px-3 pt-6 pb-2">
            <Initials name="Master Plumbers" className="size-7 text-[10px]" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Master Plumbers</p>
              <p className="text-[10px] text-emerald-600">Online</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden p-2.5">
            {CHAT.map((message, index) => {
              const visible = step >= index + 1;
              return (
                <div
                  key={message.text}
                  className={cn(
                    "max-w-[85%] transition-all duration-500",
                    EASE,
                    message.from === "me" ? "self-end" : "self-start",
                    visible ? "translate-y-0 opacity-100" : "hidden translate-y-2 opacity-0",
                  )}
                >
                  {"photo" in message ? (
                    <span className="mb-1 flex h-14 w-24 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15">
                      <ImageIcon className="size-5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <p
                    className={cn(
                      "rounded-2xl px-2.5 py-1.5 text-[11px] leading-4",
                      message.from === "me" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                    )}
                  >
                    {message.text}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 border-t p-2">
            <span className="flex-1 rounded-full border px-2.5 py-1 text-[10px] text-muted-foreground">Message…</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Send className="size-3" aria-hidden="true" />
            </span>
          </div>
        </div>
      </PhoneFrame>
      <div className="hidden w-64 flex-col gap-2.5 @md:flex">
        <p className="text-xs font-semibold text-muted-foreground">On your phone and the web</p>
        {TOASTS.map(({ icon: Icon, title, body }, index) => (
          <div
            key={title}
            className={cn(
              FLOAT_CARD,
              "flex items-start gap-2.5 p-3 transition-all duration-500",
              EASE,
              index < toastCount ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{body}</span>
            </span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* ───────────────────────── 8. Support: ticket + resolution timeline ───────────────────────── */

const SUP_TIMELINE = [
  { label: "Request opened", time: "Mon 10:02 AM" },
  { label: "Support replied", time: "Mon 10:20 AM" },
  { label: "Pro contacted", time: "Mon 11:05 AM" },
  { label: "Return visit booked", time: "Fri 2–4 PM" },
] as const;
const SUP_STEPS = SUP_TIMELINE.length + 1;
const SUP_MS = 1200;

function SupportVisual() {
  const { ref, step } = useLoopStep(SUP_STEPS, SUP_MS);
  const reached = Math.min(step, SUP_TIMELINE.length - 1);
  const resolved = step >= SUP_TIMELINE.length;
  return (
    <Stage rootRef={ref} className="grid gap-3 p-3 @md:grid-cols-[1.3fr_1fr] @md:p-5">
      <div className={cn(FLOAT_CARD, "flex flex-col overflow-hidden")}>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <LifeBuoy className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="truncate text-sm font-semibold">Help with ORD-207</p>
          </div>
          <Chip tone={resolved ? "green" : step >= 1 ? "blue" : "slate"}>{resolved ? "Resolved" : step >= 1 ? "In review" : "Open"}</Chip>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-[10px] font-semibold text-muted-foreground">You · Order issue</p>
            <p className="mt-1 text-xs leading-5">The drain is slow again two days after the cleaning. Can someone take a look?</p>
          </div>
          <div className={cn("rounded-xl border border-primary/20 bg-primary/5 p-3 transition-all duration-500", step >= 1 ? "opacity-100" : "opacity-0")}>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
              <Initials name="Request Service" className="size-5 text-[8px]" />
              Request Service support
            </p>
            <p className="mt-1 text-xs leading-5">Sorry about that, Sarah — we&apos;ve asked the pro to come back under their workmanship guarantee.</p>
          </div>
          <div
            className={cn(
              "mt-auto flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-500",
              resolved ? "border-emerald-200 bg-emerald-50 opacity-100 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "opacity-0",
            )}
          >
            <Check className="size-4 text-emerald-600" aria-hidden="true" />
            <span className="text-xs font-medium">Free return visit · Fri 2–4 PM</span>
          </div>
        </div>
      </div>
      <div className={cn(FLOAT_CARD, "hidden p-4 @md:block")}>
        <p className="text-xs font-semibold">Progress</p>
        <ol className="mt-3 flex flex-col">
          {SUP_TIMELINE.map((item, index) => {
            const done = index <= reached;
            return (
              <li key={item.label} className="relative flex gap-3 pb-4 last:pb-0">
                {index < SUP_TIMELINE.length - 1 ? (
                  <span className="absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-0.5 bg-muted">
                    <span
                      className={cn("block w-full bg-primary transition-[height] duration-700", EASE)}
                      style={{ height: index < reached ? "100%" : "0%" }}
                    />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
                    done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span>
                  <span className={cn("block text-xs", done ? "font-semibold" : "text-muted-foreground")}>{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{item.time}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </Stage>
  );
}

/* ───────────────────────── tabs ───────────────────────── */

const FEATURES = [
  {
    id: "overview",
    label: "Overview",
    title: "Your whole home project at a glance",
    body: "Sign in and see your quote requests, estimates to review, orders in progress and what you owe — plus every update as it happens.",
    alt: "Customer overview with counts, active projects, quick actions and notifications",
    Visual: OverviewVisual,
    loopMs: OV_MS * OV_FRAMES.length,
  },
  {
    id: "requests",
    label: "Quote Requests",
    title: "Describe the job once, compare pros",
    body: "Tell us what's wrong, add photos and send. Licensed local pros reply with written estimates you can compare side by side.",
    alt: "Quote request being typed and sent, then three pros replying with prices",
    Visual: QuoteRequestsVisual,
    loopMs: QR_MS * QR_STEPS,
  },
  {
    id: "estimates",
    label: "Estimates",
    title: "Itemized estimates you sign online",
    body: "Every line, price and term is written out before work starts. Approve with your signature and the job is booked.",
    alt: "Itemized estimate signed and stamped approved",
    Visual: EstimatesVisual,
    loopMs: EST_MS * EST_STEPS,
  },
  {
    id: "orders",
    label: "Orders",
    title: "Follow your job live",
    body: "See when your pro is on the way with a live ETA, know when they arrive, and approve any change order before extra work is done.",
    alt: "Map with a technician driving to the customer's home, order progress and a change order",
    Visual: OrdersVisual,
    loopMs: ORDER_MS * ORDER_STEPS,
  },
  {
    id: "invoices",
    label: "Invoices",
    title: "Pay exactly what you agreed to",
    body: "Invoices show the original estimate, the extras you approved and any deposit — then pay the balance securely online.",
    alt: "Invoice with estimate, change order and deposit being paid",
    Visual: InvoicesVisual,
    loopMs: INV_MS * INV_STEPS,
  },
  {
    id: "payments",
    label: "Payments",
    title: "Every payment and receipt, saved",
    body: "Deposits, balances and fixed-price bookings are recorded against their job, with a receipt for each — handy for warranties and taxes.",
    alt: "Monthly payments chart, payment history and a printed receipt",
    Visual: PaymentsVisual,
    loopMs: PAY_MS * PAY_STEPS,
  },
  {
    id: "messages",
    label: "Messages",
    title: "Talk to your pro in one thread",
    body: "Message the company, share photos of the problem and confirm visit times — with notifications on your phone and the web.",
    alt: "Phone chat with a plumbing company and notifications for the visit",
    Visual: MessagesVisual,
    loopMs: CHAT_MS * CHAT_STEPS,
  },
  {
    id: "support",
    label: "Support",
    title: "Help when something isn't right",
    body: "Open a support request about any order. Our team follows up with you and the pro until it's sorted.",
    alt: "Support request about an order moving to resolved with a return visit",
    Visual: SupportVisual,
    loopMs: SUP_MS * SUP_STEPS,
  },
] as const;

export function CustomerFeatureTabs() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);
  const [highlight, setHighlight] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const feature = FEATURES[active];
  const Visual = feature.Visual;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion()) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pinned || !inView) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % FEATURES.length), feature.loopMs + 600);
    return () => window.clearTimeout(timer);
  }, [active, feature.loopMs, pinned, inView]);

  // Tabs rewrap with the width (and fonts can load late), so re-measure on resize.
  useEffect(() => {
    const list = tabListRef.current;
    const tab = tabRefs.current[active];
    if (!list || !tab) return;
    const measure = () => setHighlight({ left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  const choose = (index: number) => {
    setPinned(true);
    setActive(index);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + FEATURES.length) % FEATURES.length;
    choose(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section id="customer-dashboard" className="scroll-mt-24 bg-background">
      <Container ref={rootRef} className="flex flex-col gap-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="eyebrow text-primary">Your customer dashboard</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Track your whole project, from quote to paid
          </h2>
          <p className="text-sm leading-7 text-muted-foreground md:text-base">
            Every Request Service customer gets a free dashboard — quote requests, estimates, orders, invoices,
            payments, messages and support in one place.
          </p>
        </div>

        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Customer dashboard sections"
          className="relative mx-auto flex max-w-5xl flex-wrap justify-center gap-1"
        >
          {highlight ? <span aria-hidden="true" className="rs-tab-active" style={highlight} /> : null}
          {FEATURES.map((tab, index) => {
            const selected = index === active;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`customer-feature-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls="customer-feature-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(index)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id="customer-feature-panel"
          role="tabpanel"
          aria-labelledby={`customer-feature-tab-${feature.id}`}
          className="overflow-hidden rounded-3xl border border-border/70 bg-background"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div role="img" aria-label={feature.alt} className="rs-stage @container relative order-last h-104 overflow-hidden lg:order-first">
              <div key={feature.id} className="animate-in fade-in absolute inset-0 duration-200">
                <Visual />
              </div>
            </div>
            <div
              key={feature.id}
              className="animate-in fade-in flex flex-col items-start justify-center gap-3 bg-background p-6 duration-200 sm:p-8 lg:p-10"
            >
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{feature.label}</p>
              <h3 className="text-balance text-2xl font-semibold tracking-tight md:text-[1.75rem] md:leading-[1.2]">
                {feature.title}
              </h3>
              <p className="text-sm leading-7 text-muted-foreground">{feature.body}</p>
              <Link
                href="/get-a-quote"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
              >
                Get a free quote
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
