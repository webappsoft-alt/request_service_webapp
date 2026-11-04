"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Banknote,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  CreditCard,
  Droplets,
  Fan,
  FilePlus2,
  Flame,
  Globe,
  Landmark,
  MessageCircle,
  MousePointer2,
  Phone,
  Plug,
  Receipt,
  Search,
  UserPlus,
  Wind,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  CALL_LOOP_MS,
  ReceptionistCallCard,
} from "@/components/pro-v1/pro-ai-receptionist";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { getData } from "@/components/api/sliceHttp";
import { cn } from "@/lib/utils";
import {
  normalizePublicFixedService,
  type PublicFixedService,
} from "@/store/publicFixedServicesSlice";

/**
 * One visual per pro dashboard tab on /for-pros-v1, each with its own kind of motion: count-ups, a
 * card deck, an org chart, a route, a printing receipt, a drawn signature, and so on. Sample data.
 * Each sits in an `@container` stage, so secondary pieces drop out on phones.
 */

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const FLOAT_CARD =
  "rounded-2xl border border-border/70 bg-background shadow-[0_16px_40px_-24px_rgba(0,63,125,0.4)]";
/** Pause before a visual starts moving, so a tab comes alive as soon as it's picked. */
const FIRST_STEP_MS = 250;

const dollars = (value: number) =>
  `$${Math.round(value).toLocaleString("en-US")}`;
const whole = (value: number) => String(Math.round(value));
const clockHours = (value: number) => {
  const hours = Math.floor(value);
  return `${hours}:${String(Math.floor((value - hours) * 60)).padStart(2, "0")}`;
};
const oneDecimal = (value: number) => value.toFixed(1);

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Advances 0 → steps - 1 and loops while on screen. Shows the end state with reduced motion. */
function useLoopStep(steps: number, stepMs: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reducedMotion()) {
      setStep(steps - 1);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );
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

/** A number easing to `value`. Writes straight to the DOM, so the visual doesn't re-render per frame. */
function CountUp({
  value,
  format = whole,
  ms = 900,
}: {
  value: number;
  format?: (value: number) => string;
  ms?: number;
}) {
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

function Ring({
  value,
  ms = 900,
  stroke = 3,
  className,
  children,
}: {
  /** 0 to 1. */
  value: number;
  ms?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <svg
        viewBox="0 0 36 36"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth={stroke}
          className="stroke-primary/10"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - value}
          className="stroke-primary transition-[stroke-dashoffset] ease-out"
          style={{ transitionDuration: `${ms}ms` }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </span>
    </div>
  );
}

function Stage({
  rootRef,
  className,
  children,
}: {
  rootRef: React.Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div ref={rootRef} className={cn("relative size-full", className)}>
      {children}
    </div>
  );
}

function Cursor({ className }: { className?: string }) {
  return (
    <MousePointer2
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-20 size-5 fill-foreground stroke-background drop-shadow",
        className,
      )}
    />
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
        .join("")}
    </span>
  );
}

function PhoneFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border-[6px] border-[#0b1a2e] bg-background shadow-[0_30px_60px_-24px_rgba(2,16,36,0.6)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-1.5 left-1/2 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-[#0b1a2e]"
      />
      {children}
    </div>
  );
}

/** Dashboard: the working day on one screen, with stats, actions, shortcuts, and notifications. */
const DASH_FRAMES = [
  { jobs: 3, cash: 1240, leads: 2, overdue: 2, handled: 0 },
  { jobs: 4, cash: 2860, leads: 4, overdue: 1, handled: 1 },
  { jobs: 5, cash: 4180, leads: 3, overdue: 1, handled: 2 },
  { jobs: 6, cash: 5630, leads: 5, overdue: 0, handled: 3 },
] as const;
const DASH_ACTIONS = [
  { tag: "Overdue invoice", title: "INV-559", who: "Noah Bennett · 19 days" },
  {
    tag: "New lead",
    title: "REQ-643 · Plumbing",
    who: "Sarah Collins · Denver",
  },
  {
    tag: "Unassigned job",
    title: "JOB-376 · Water heater",
    who: "Needs a crew",
  },
  {
    tag: "Estimate follow-up",
    title: "EST-588 · Panel upgrade",
    who: "Ava Mitchell · sent 3 days ago",
  },
  {
    tag: "Change order",
    title: "JOB-381 · Approved extra",
    who: "Liam Foster · $95",
  },
] as const;
const DASH_SHORTCUTS = [
  { label: "New estimate", icon: FilePlus2 },
  { label: "Create job", icon: BriefcaseBusiness },
  { label: "Create lead", icon: UserPlus },
  { label: "Send invoice", icon: Receipt },
] as const;
const DASH_NOTES = [
  "AI booked a visit · Thu 9:00 AM",
  "Invoice INV-559 paid · $1,620",
  "Tate F. finished JOB-983",
  "Estimate EST-584 signed",
] as const;
const DASH_MS = 1800;

function DashboardVisual() {
  const { ref, step } = useLoopStep(DASH_FRAMES.length, DASH_MS);
  const frame = DASH_FRAMES[step];
  const stats = [
    { label: "Active jobs", value: frame.jobs, format: whole },
    { label: "Collected today", value: frame.cash, format: dollars },
    { label: "New leads", value: frame.leads, format: whole, wide: true },
    {
      label: "Overdue invoices",
      value: frame.overdue,
      format: whole,
      wide: true,
    },
  ];
  const notes = [DASH_NOTES[step], DASH_NOTES[(step + 3) % DASH_NOTES.length]];

  return (
    <Stage rootRef={ref} className="flex flex-col gap-2.5 p-3 @md:p-4">
      <div className="grid shrink-0 grid-cols-2 gap-2.5 @md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              FLOAT_CARD,
              "px-3 py-2.5",
              stat.wide && "hidden @md:block",
            )}
          >
            <p className="truncate text-[11px] text-muted-foreground">
              {stat.label}
            </p>
            <p className="text-xl font-semibold tracking-tight">
              <CountUp value={stat.value} format={stat.format} />
            </p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-2.5 @md:grid-cols-[1.25fr_1fr]">
        <div
          className={cn(FLOAT_CARD, "flex min-h-0 flex-col overflow-hidden")}
        >
          <p className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold">
            Important actions
          </p>
          <ul className="grid min-h-0 flex-1 auto-rows-fr divide-y divide-border">
            {DASH_ACTIONS.map((action, index) => {
              const done = index < frame.handled;
              return (
                <li
                  key={action.title}
                  className="flex items-center gap-2 px-3 py-1"
                >
                  <div
                    className={cn(
                      "min-w-0 flex-1 transition-opacity duration-500",
                      done && "opacity-45",
                    )}
                  >
                    <p className="text-[9px] font-semibold tracking-wider text-primary uppercase">
                      {action.tag}
                    </p>
                    <p className="truncate text-xs font-semibold">
                      {action.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {action.who}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors duration-300",
                      done
                        ? "bg-primary/10 text-primary"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {done ? (
                      <>
                        <Check className="size-3" aria-hidden="true" /> Done
                      </>
                    ) : (
                      "View"
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hidden min-h-0 flex-col gap-2.5 @md:flex">
          <div className={cn(FLOAT_CARD, "shrink-0 p-3")}>
            <p className="text-xs font-semibold">Quick actions</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {DASH_SHORTCUTS.map(({ label, icon: Icon }, index) => (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors duration-500",
                    index === step
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border",
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
                    index === 0
                      ? "animate-in fade-in slide-in-from-top-2 bg-primary/8 font-medium duration-500"
                      : "text-muted-foreground",
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

/** Pipeline: a card lifted and carried across columns. */
const PIPELINE_COLUMNS = [
  {
    name: "Leads",
    total: "$1,190",
    cards: [
      { name: "Drain cleaning", amount: "$180" },
      { name: "AC tune-up", amount: "$129" },
      { name: "Gutter repair", amount: "$881" },
    ],
  },
  {
    name: "Estimates",
    total: "$4,260",
    cards: [
      { name: "Panel upgrade", amount: "$2,400" },
      { name: "AC repair", amount: "$640" },
      { name: "Faucet swap", amount: "$1,220" },
    ],
  },
  {
    name: "Scheduled",
    total: "$3,935",
    cards: [
      { name: "Fixture install", amount: "$310" },
      { name: "Roof repair", amount: "$2,700" },
      { name: "Water softener", amount: "$925" },
    ],
  },
] as const;
const PIPELINE_FRAMES = [
  { col: 0, label: "New lead", lift: false },
  { col: 0, label: "New lead", lift: true },
  { col: 1, label: "Estimate sent", lift: true },
  { col: 1, label: "Estimate sent", lift: false },
  { col: 1, label: "Estimate signed", lift: true },
  { col: 2, label: "Thu 9:00 AM", lift: true },
  { col: 2, label: "Thu 9:00 AM", lift: false },
  { col: 2, label: "Thu 9:00 AM", lift: false },
] as const;
const PIPELINE_MS = 1100;

function PipelineVisual() {
  const { ref, step } = useLoopStep(PIPELINE_FRAMES.length, PIPELINE_MS);
  const frame = PIPELINE_FRAMES[step];
  const notified = step === PIPELINE_FRAMES.length - 1;

  return (
    <Stage
      rootRef={ref}
      className="flex items-center p-4 pb-13 @md:px-6 @md:pt-4 @md:pb-13"
    >
      <div className="relative w-full">
        <div className="grid grid-cols-3 gap-2 @md:gap-3">
          {PIPELINE_COLUMNS.map((column, index) => (
            <div
              key={column.name}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border/70 bg-background/70 p-2"
            >
              <p className="flex items-center justify-between gap-1 px-1 pt-1 text-xs font-semibold">
                <span className="truncate">{column.name}</span>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] text-primary tabular-nums">
                  {column.cards.length + (frame.col === index ? 1 : 0)}
                </span>
              </p>
              <div className="h-20 shrink-0 rounded-xl border border-dashed border-primary/25" />
              {column.cards.map((card) => (
                <div
                  key={card.name}
                  className="flex items-center justify-between gap-1 rounded-xl bg-background px-2.5 py-2 text-xs shadow-sm"
                >
                  <span className="truncate">{card.name}</span>
                  <span className="hidden shrink-0 text-[10px] text-muted-foreground tabular-nums @md:inline">
                    {card.amount}
                  </span>
                </div>
              ))}
              <p className="truncate border-t border-border/70 px-1 pt-1.5 text-[10px] text-muted-foreground">
                Total{" "}
                <span className="font-semibold text-foreground">
                  {column.total}
                </span>
              </p>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "absolute top-9 transition-[left] duration-1000 motion-reduce:transition-none",
            EASE,
          )}
          style={{
            left: `calc(${frame.col} * 100% / 3)`,
            width: "calc(100% / 3)",
          }}
        >
          <div
            className={cn(
              "relative mx-2 h-20 rounded-xl border border-primary bg-background p-2.5 transition-[transform,box-shadow] duration-500",
              EASE,
              frame.lift
                ? "-translate-y-1 -rotate-2 scale-105 shadow-2xl"
                : "shadow-md",
            )}
          >
            <p className="text-[11px] font-semibold text-primary">REQ-611</p>
            <p className="truncate text-xs font-medium">Water heater</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {frame.label}
            </p>
            {frame.lift ? <Cursor className="right-1 -bottom-2" /> : null}
          </div>
        </div>
        <div
          className={cn(
            "absolute inset-x-0 -bottom-11 mx-auto w-fit max-w-[95%] truncate rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xl transition-[transform,opacity] duration-500",
            notified ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          )}
        >
          Customer and crew notified
        </div>
      </div>
    </Stage>
  );
}

/** Customers: the list picks a customer and their file comes to the front of the deck. */
const CUSTOMER_CARDS = [
  {
    name: "Olivia Hart",
    address: "2217 Maple Street, Aurora",
    jobs: 3,
    estimates: 2,
    owing: "$156",
    source: "AI call",
    activity: [
      "Invoice INV-874 sent · $156",
      "JOB-983 completed · Furnace cleaning",
      "Estimate EST-584 signed",
    ],
  },
  {
    name: "Noah Bennett",
    address: "615 Pine Street, Denver",
    jobs: 5,
    estimates: 4,
    owing: "$0",
    source: "Website",
    activity: [
      "Paid INV-559 · $1,620",
      "JOB-376 scheduled · Thu 9:00 AM",
      "New request REQ-643 · Plumbing",
    ],
  },
  {
    name: "Ava Mitchell",
    address: "98 Cedar Court, Lakewood",
    jobs: 2,
    estimates: 3,
    owing: "$0",
    source: "Referral",
    activity: [
      "Estimate EST-588 viewed · Panel upgrade",
      "Site visit booked · Mon 10:00 AM",
      "Note added · Gate code 4417",
    ],
  },
] as const;
const CUSTOMER_EXTRAS = [
  "Liam Foster",
  "Grace Kim",
  "Ethan Brooks",
  "Chloe Ramos",
] as const;
const CUSTOMERS_MS = 2200;
/** When each "Recent activity" line happened, newest first. */
const ACTIVITY_TIMES = ["Today", "Yesterday", "Mon"] as const;

function CustomersVisual() {
  const { ref, step } = useLoopStep(CUSTOMER_CARDS.length, CUSTOMERS_MS);

  return (
    <Stage rootRef={ref} className="flex items-center justify-center p-4">
      {/* List and detail share one height (from @xl) so their tops and bottoms line up. */}
      <div className="flex w-full max-w-[38rem] items-stretch justify-center gap-4 @xl:h-[21rem]">
        <div
          className={cn(
            FLOAT_CARD,
            "hidden w-44 shrink-0 flex-col overflow-hidden @xl:flex",
          )}
        >
          <p className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-[11px] text-muted-foreground">
            <Search className="size-3.5" aria-hidden="true" /> Search customers
          </p>
          <ul className="p-1.5">
            {[
              ...CUSTOMER_CARDS.map((card) => card.name),
              ...CUSTOMER_EXTRAS,
            ].map((name, index) => (
              <li
                key={name}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors duration-500",
                  index === step && "bg-primary/10 text-primary",
                )}
              >
                <Initials name={name} className="size-6 text-[9px]" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">248</span> customers
            · 12 this month
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3 @xl:justify-between">
          <div className="relative h-44 w-full">
            {CUSTOMER_CARDS.map((customer, index) => {
              const position =
                (index - step + CUSTOMER_CARDS.length) % CUSTOMER_CARDS.length;
              return (
                <div
                  key={customer.name}
                  className={cn(
                    FLOAT_CARD,
                    "absolute inset-x-0 top-0 p-5 transition-[transform,opacity] duration-1000",
                    EASE,
                  )}
                  style={{
                    transform: `translateY(${position * 18}px) scale(${1 - position * 0.06})`,
                    opacity: 1 - position * 0.28,
                    zIndex: CUSTOMER_CARDS.length - position,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Initials name={customer.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.address}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      {customer.source}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      [customer.jobs, "Jobs"],
                      [customer.estimates, "Estimates"],
                      [customer.owing, "Owing"],
                    ].map(([value, label]) => (
                      <div
                        key={label}
                        className="rounded-xl bg-primary/6 py-2.5"
                      >
                        <p className="text-base font-semibold tabular-nums">
                          {value}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            key={CUSTOMER_CARDS[step].name}
            className={cn(FLOAT_CARD, "animate-in fade-in p-4 duration-500")}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Recent activity</p>
              <p className="text-[10px] text-muted-foreground">
                {CUSTOMER_CARDS[step].name.split(" ")[0]}&apos;s file
              </p>
            </div>
            <ul className="mt-3 flex flex-col gap-2.5">
              {CUSTOMER_CARDS[step].activity.map((item, index) => (
                <li key={item} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      index === 0 ? "bg-primary" : "bg-primary/25",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate",
                      index === 0 ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {item}
                  </span>
                  <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted-foreground tabular-nums">
                    {ACTIVITY_TIMES[index]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** Employees: an org chart, owner to office to field, with the selected person's details. */
const CREW = [
  {
    name: "Jordan Burt",
    role: "Owner",
    x: 50,
    y: 14,
    from: null,
    pay: "Owner",
    jobs: 2,
    portal: false,
  },
  {
    name: "Dana Hodge",
    role: "Dispatcher",
    x: 25,
    y: 50,
    from: 0,
    pay: "$24/hr",
    jobs: 0,
    portal: false,
  },
  {
    name: "Evan Puckett",
    role: "Estimator",
    x: 75,
    y: 50,
    from: 0,
    pay: "$28/hr",
    jobs: 4,
    portal: false,
  },
  {
    name: "Tate Fischer",
    role: "Technician",
    x: 25,
    y: 86,
    from: 1,
    pay: "$32/hr",
    jobs: 6,
    portal: true,
  },
  {
    name: "Maria Lee",
    role: "Technician",
    x: 75,
    y: 86,
    from: 1,
    pay: "$30/hr",
    jobs: 5,
    portal: true,
  },
] as const;
const EMPLOYEES_MS = 1700;

function EmployeesVisual() {
  const { ref, step } = useLoopStep(CREW.length, EMPLOYEES_MS);
  const active = CREW[step];

  return (
    <Stage rootRef={ref} className="flex gap-3 p-3 @md:p-4">
      <div className="relative min-w-0 flex-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden="true"
        >
          {CREW.map((member, index) => {
            if (member.from === null) return null;
            const parent = CREW[member.from];
            return (
              <line
                key={member.name}
                x1={parent.x}
                y1={parent.y}
                x2={member.x}
                y2={member.y}
                vectorEffect="non-scaling-stroke"
                strokeWidth={index === step ? 2 : 1}
                className={cn(
                  index === step
                    ? "rs-dash-flow stroke-primary"
                    : "stroke-primary/25",
                )}
              />
            );
          })}
        </svg>
        {CREW.map((member, index) => (
          <div
            key={member.name}
            className={cn(
              "absolute flex w-[46%] max-w-40 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border bg-background p-1.5 shadow-sm transition-[border-color,box-shadow] duration-500",
              index === step
                ? "border-primary shadow-lg ring-3 ring-primary/10"
                : "border-border",
            )}
            style={{ left: `${member.x}%`, top: `${member.y}%` }}
          >
            <Initials name={member.name} className="size-7 text-[10px]" />
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold">
                {member.name}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {member.role}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div
        key={active.name}
        className={cn(
          FLOAT_CARD,
          "animate-in fade-in hidden w-52 shrink-0 flex-col self-center p-4 duration-300 @xl:flex",
        )}
      >
        <div className="flex items-center gap-2.5">
          <Initials name={active.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {active.name}
            </p>
            <p className="truncate text-[11px] text-primary">{active.role}</p>
          </div>
        </div>
        <dl className="mt-3 flex flex-col divide-y divide-border text-[11px]">
          {[
            ["Pay rate", active.pay],
            ["Assigned work", `${active.jobs} open`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 py-1.5">
            <dt className="text-muted-foreground">Technician login</dt>
            <dd className="font-medium">{active.portal ? "Active" : "None"}</dd>
          </div>
        </dl>
        <ul className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {(active.portal
            ? ["Schedule", "Jobs", "Clock in"]
            : ["Office team"]
          ).map((item) => (
            <li
              key={item}
              className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
}

/** Timesheets: a phone with a clock-in timer whose ring sweeps as the day's hours add up. */
const TIME_FRAMES = [
  { hours: 0, on: false },
  { hours: 2.5, on: true },
  { hours: 5, on: true },
  { hours: 8, on: true },
  { hours: 8, on: false },
] as const;
const WEEK = [
  ["Mon", 8],
  ["Tue", 7.5],
  ["Wed", 8],
  ["Thu", 6.5],
] as const;
const WEEK_HOURS = 30;
const TIMESHEETS_MS = 1700;
const PAY_RATE = 32;

function TimesheetsVisual() {
  const { ref, step } = useLoopStep(TIME_FRAMES.length, TIMESHEETS_MS);
  const frame = TIME_FRAMES[step];
  const finished = step === TIME_FRAMES.length - 1;

  return (
    <Stage rootRef={ref} className="flex items-center justify-center gap-5 p-3">
      <PhoneFrame className="h-82 w-44 shrink-0 @md:h-89">
        <div className="flex h-full flex-col items-center gap-3 px-3 pt-8 pb-3">
          <p className="text-xs font-semibold tracking-tight">Tate Fischer</p>
          <Ring
            value={frame.hours / 8}
            ms={1500}
            stroke={2.5}
            className="size-28"
          >
            <span className="text-lg font-semibold">
              <CountUp value={frame.hours} format={clockHours} ms={1500} />
            </span>
            <span className="text-[10px] text-muted-foreground">
              hours today
            </span>
          </Ring>
          <p className="text-xs font-semibold">
            <CountUp
              value={frame.hours * PAY_RATE}
              format={dollars}
              ms={1500}
            />{" "}
            earned
          </p>
          <div className="mt-auto w-full rounded-xl border border-border px-2.5 py-2 text-[10px]">
            <p className="flex items-center gap-1.5 font-medium">
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-500",
                  frame.on ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              {frame.on
                ? "On the clock"
                : finished
                  ? "Day done"
                  : "Not started"}
            </p>
            <p className="mt-0.5 truncate text-muted-foreground">
              JOB-983 · Furnace cleaning
            </p>
          </div>
          <span
            className={cn(
              "w-full rounded-xl py-2.5 text-center text-xs font-semibold transition-colors duration-500",
              frame.on
                ? "bg-primary/10 text-primary"
                : "bg-primary text-primary-foreground",
            )}
          >
            {frame.on ? "Clock out" : finished ? "Clocked out" : "Clock in"}
          </span>
        </div>
      </PhoneFrame>
      <div className="hidden h-89 w-56 flex-col justify-between gap-3 @md:flex">
        <div className={cn(FLOAT_CARD, "p-4")}>
          <p className="text-xs font-semibold">This week</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {WEEK.map(([day, value]) => (
              <li key={day} className="flex items-center gap-2 text-[11px]">
                <span className="w-7 text-muted-foreground">{day}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(value / 8) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right tabular-nums">{value}h</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-[11px]">
              <span className="w-7 font-medium text-primary">Fri</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                <span
                  className="block h-full rounded-full bg-primary transition-[width] duration-1500 ease-out"
                  style={{ width: `${(frame.hours / 8) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-medium">
                <CountUp value={frame.hours} format={oneDecimal} ms={1500} />h
              </span>
            </li>
          </ul>
          <p className="mt-3 border-t border-border pt-3 text-xs font-semibold">
            <CountUp
              value={WEEK_HOURS + frame.hours}
              format={oneDecimal}
              ms={1500}
            />{" "}
            hrs ·{" "}
            <CountUp
              value={(WEEK_HOURS + frame.hours) * PAY_RATE}
              format={dollars}
              ms={1500}
            />
          </p>
        </div>
        <div className={cn(FLOAT_CARD, "p-4")}>
          <p className="text-xs font-semibold">Crew today</p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              { name: "Tate Fischer", on: frame.on, note: "JOB-983" },
              { name: "Maria Lee", on: true, note: "JOB-376" },
              { name: "Sam Ortiz", on: false, note: "Off at 3:00 PM" },
            ].map((member) => (
              <li
                key={member.name}
                className="flex items-center gap-2 text-[11px]"
              >
                <Initials name={member.name} className="size-5 text-[8px]" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {member.name}
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-[10px] transition-colors duration-500",
                    member.on ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      member.on ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  {member.on ? member.note : "Clocked out"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Stage>
  );
}

/** Leads: website, chat, and phone flow along lines into a stack of incoming cards. */
const LEAD_SOURCES = [
  { label: "Website", icon: Globe },
  { label: "Chat", icon: MessageCircle },
  { label: "Phone", icon: Phone },
] as const;
const LEAD_FEED = [
  {
    id: "REQ-973",
    name: "Sarah Collins",
    service: "Leak detection",
    source: 0,
  },
  { id: "REQ-974", name: "Daniel Reyes", service: "Water heater", source: 2 },
  { id: "REQ-975", name: "Mia Sanders", service: "Panel upgrade", source: 1 },
  { id: "REQ-976", name: "Liam Foster", service: "AC tune-up", source: 0 },
  { id: "REQ-977", name: "Grace Kim", service: "Roof inspection", source: 2 },
  { id: "REQ-978", name: "Ethan Brooks", service: "Outlet repair", source: 1 },
] as const;
/** Where a lead sits once newer ones arrive above it (by row). */
const LEAD_STAGES = [
  "Contacted",
  "Estimate sent",
  "Site visit",
  "Won",
] as const;
const LEADS_SHOWN = 5;
const LEADS_MS = 1700;

function LeadsVisual() {
  const { ref, step } = useLoopStep(LEAD_FEED.length, LEADS_MS);
  const source = LEAD_FEED[step].source;
  const shown = Array.from({ length: LEADS_SHOWN }, (_, offset) => offset).map(
    (offset) =>
      LEAD_FEED[(step - offset + LEAD_FEED.length) % LEAD_FEED.length],
  );

  return (
    <Stage
      rootRef={ref}
      className="flex flex-col justify-center gap-4 p-4 @md:flex-row @md:items-center @md:gap-0 @md:p-6"
    >
      <ul className="flex justify-center gap-2 @md:w-32 @md:flex-col @md:gap-6">
        {LEAD_SOURCES.map(({ label, icon: Icon }, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-[background-color,border-color,color,transform] duration-500",
              index === source
                ? "scale-105 border-primary bg-primary text-primary-foreground shadow-lg"
                : "border-border bg-background",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" /> {label}
          </li>
        ))}
      </ul>
      <svg
        viewBox="0 0 60 150"
        className="hidden h-44 w-16 shrink-0 @md:block"
        aria-hidden="true"
      >
        {[22, 75, 128].map((y, index) => (
          <path
            key={y}
            d={`M0 ${y} C 30 ${y}, 30 75, 60 75`}
            fill="none"
            strokeWidth={index === source ? 2 : 1}
            className={cn(
              index === source
                ? "rs-dash-flow stroke-primary"
                : "stroke-primary/20",
            )}
          />
        ))}
      </svg>
      <div className={cn(FLOAT_CARD, "min-w-0 flex-1 overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">Leads</p>
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            <CountUp value={126 + step} />
          </span>
        </div>
        <ul className="divide-y divide-border">
          {shown.map((lead, index) => (
            <li
              key={lead.id}
              className={cn(
                "flex items-center gap-3 px-4 py-2",
                index === 0 &&
                  "animate-in fade-in slide-in-from-top-4 bg-primary/5 duration-700",
              )}
            >
              <Initials name={lead.name} className="size-8 text-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{lead.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {lead.id} · {lead.service}
                </p>
              </div>
              {index === 0 ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  New
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {LEAD_STAGES[index - 1]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
}

/** Estimate: a full document that fills in, totals up, and gets signed by hand. */
const ESTIMATE_LINES = [
  { name: "Water heater install", kind: "Labor", price: 480 },
  { name: "50-gal gas water heater", kind: "Material", price: 1150 },
  { name: "Expansion tank", kind: "Material", price: 95 },
  { name: "Haul away old unit", kind: "Equipment", price: 75 },
] as const;
const TAX_RATE = 0.08;
const ESTIMATE_STEPS = ESTIMATE_LINES.length + 2;
const ESTIMATE_MS = 1100;

function EstimateVisual() {
  const { ref, step } = useLoopStep(ESTIMATE_STEPS, ESTIMATE_MS);
  const subtotal = ESTIMATE_LINES.slice(0, step + 1).reduce(
    (sum, line) => sum + line.price,
    0,
  );
  const tax = subtotal * TAX_RATE;
  const signing = step >= ESTIMATE_LINES.length;
  const signed = step >= ESTIMATE_LINES.length + 1;
  const status = signed
    ? "Approved"
    : step >= ESTIMATE_LINES.length - 1
      ? "Sent to customer"
      : "Draft";

  return (
    <Stage
      rootRef={ref}
      className="flex items-center justify-center p-3 @md:p-4"
    >
      <div className={cn(FLOAT_CARD, "w-full max-w-lg p-4 @md:px-5")}>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold tracking-tight">
            Estimate EST-584
          </p>
          <span
            key={status}
            className={cn(
              "animate-in fade-in zoom-in-90 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium duration-300",
              signed
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {status}
          </span>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-primary/5 p-2 text-[10px] @md:grid-cols-3">
          {[
            ["Customer", "Olivia Hart"],
            ["Property", "2217 Maple Street"],
            ["Valid until", "Dec 3, 2026"],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={cn("min-w-0", index === 2 && "hidden @md:block")}
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-2.5 flex flex-col gap-1">
          {ESTIMATE_LINES.map((line, index) => (
            <li
              key={line.name}
              className={cn(
                "flex items-center gap-3 text-xs transition-[opacity,transform] duration-500",
                EASE,
                index <= step
                  ? "translate-y-0 opacity-100"
                  : "translate-y-1 opacity-0",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{line.name}</span>
              <span className="hidden w-16 text-[10px] text-muted-foreground @md:block">
                {line.kind}
              </span>
              <span className="w-12 text-right tabular-nums">
                {dollars(line.price)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-border pt-2.5">
          <dl className="text-[11px] text-muted-foreground">
            <div className="flex gap-3">
              <dt>Subtotal</dt>
              <dd>
                <CountUp value={subtotal} format={dollars} ms={600} />
              </dd>
            </div>
            <div className="flex gap-3">
              <dt>Tax (8%)</dt>
              <dd>
                <CountUp value={tax} format={dollars} ms={600} />
              </dd>
            </div>
          </dl>
          <p className="text-lg font-semibold tracking-tight">
            <span className="mr-2 text-xs font-medium text-muted-foreground">
              Total
            </span>
            <CountUp value={subtotal + tax} format={dollars} ms={600} />
          </p>
        </div>
        <div className="relative mt-2 h-12 border-b border-dashed border-border">
          <svg
            viewBox="0 0 180 50"
            className="absolute bottom-0 left-0 h-12 w-36"
            aria-hidden="true"
          >
            <path
              d="M6 34 C 18 6, 26 8, 24 28 S 34 48, 44 24 S 58 12, 62 30 S 76 38, 86 22 S 100 16, 106 30 S 134 34, 172 18"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={signing ? 0 : 1}
              className={cn(
                "stroke-primary",
                signing &&
                  "transition-[stroke-dashoffset] duration-1000 ease-in-out",
              )}
            />
          </svg>
          <span
            className={cn(
              "absolute right-0 bottom-2 flex items-center gap-1 text-[11px] font-medium text-primary transition-opacity duration-500",
              signed ? "opacity-100" : "opacity-0",
            )}
          >
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            Signed Nov 3
          </span>
        </div>
      </div>
    </Stage>
  );
}

/** Jobs: a board of today's jobs; the featured one moves through its stages, card and list in sync. */
const JOB_STAGES = [
  "Scheduled",
  "On the way",
  "Arrived",
  "In progress",
  "Completed",
] as const;
const JOB_BOARD = [
  {
    id: "JOB-983",
    service: "Furnace cleaning",
    customer: "Olivia Hart",
    tech: "Tate Fischer",
    time: "9:00 AM",
    amount: "$237",
    stage: null,
  },
  {
    id: "JOB-376",
    service: "Water heater install",
    customer: "Noah Bennett",
    tech: "Maria Lee",
    time: "11:30 AM",
    amount: "$1,840",
    stage: 3,
  },
  {
    id: "JOB-381",
    service: "Panel upgrade",
    customer: "Liam Foster",
    tech: "Sam Ortiz",
    time: "1:00 PM",
    amount: "$2,535",
    stage: 0,
  },
  {
    id: "JOB-379",
    service: "Drain cleaning",
    customer: "Ava Mitchell",
    tech: "Tate Fischer",
    time: "8:00 AM",
    amount: "$180",
    stage: 4,
  },
] as const;
const JOBS_MS = 1600;

function JobsVisual() {
  const { ref, step } = useLoopStep(JOB_STAGES.length, JOBS_MS);
  const featured = JOB_BOARD[0];

  return (
    <Stage rootRef={ref} className="flex items-center gap-3 p-3 @md:p-4">
      <div className={cn(FLOAT_CARD, "min-w-0 flex-1 overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-xs font-semibold">Today&apos;s jobs</p>
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {1 + (step === JOB_STAGES.length - 1 ? 1 : 0)}
            </span>{" "}
            of 4 completed
          </span>
        </div>
        <ul className="divide-y divide-border">
          {JOB_BOARD.map((job, index) => {
            const stage = job.stage ?? step;
            const done = stage === JOB_STAGES.length - 1;
            return (
              <li
                key={job.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-500",
                  index === 0 && "bg-primary/5",
                )}
              >
                <Initials name={job.tech} className="size-7 text-[9px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {job.id} · {job.service}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {job.time} · {job.customer}
                  </p>
                </div>
                <span
                  key={stage}
                  className={cn(
                    "animate-in fade-in shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium duration-500",
                    done
                      ? "bg-primary/10 text-primary"
                      : index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {JOB_STAGES[stage]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className={cn(FLOAT_CARD, "hidden w-56 shrink-0 flex-col p-4 @xl:flex")}
      >
        <p className="text-[11px] font-semibold text-primary">{featured.id}</p>
        <p className="truncate text-sm font-semibold tracking-tight">
          {featured.service}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {featured.customer} · 2217 Maple Street
        </p>
        <ol className="mt-3 flex flex-col">
          {JOB_STAGES.map((label, index) => (
            <li
              key={label}
              className="relative flex items-center gap-2.5 pb-2.5 last:pb-0"
            >
              {index < JOB_STAGES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-5 bottom-0 left-2.25 w-0.5 transition-colors duration-500",
                    index < step ? "bg-primary" : "bg-primary/12",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                  index <= step
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  index === step
                    ? "font-semibold"
                    : index < step
                      ? "font-medium"
                      : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Initials name={featured.tech} className="size-5 text-[8px]" />
            {featured.tech}
          </span>
          <span className="font-semibold">{featured.amount}</span>
        </div>
      </div>
    </Stage>
  );
}

/** Schedules: a job is carried across the week and lands on a technician, with a ripple. */
const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const SCHEDULE_LANES = [
  { name: "Open", jobs: [] },
  {
    name: "Maria",
    jobs: [
      { day: 2, label: "Estimate", time: "9 AM" },
      { day: 4, label: "Inspection", time: "2 PM" },
    ],
  },
  { name: "Tate", jobs: [{ day: 0, label: "Install", time: "8 AM" }] },
  { name: "Sam", jobs: [{ day: 3, label: "Repair", time: "11 AM" }] },
] as const;

/** A calendar event card like the portal's: accent bar, title, and a time tag. */
function ScheduleEvent({
  label,
  time,
  className,
  style,
  children,
}: {
  label: string;
  time: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute flex w-[19%] flex-col justify-center overflow-hidden rounded-md border bg-background py-1 pr-1 pl-2.5 shadow-sm",
        className,
      )}
      style={style}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 rounded-l-md bg-linear-to-b from-primary to-primary/70"
      />
      <span className="truncate text-[10px] leading-tight font-bold">
        {label}
      </span>
      <span className="hidden w-fit truncate rounded-sm bg-primary/10 px-1 py-px text-[8px] leading-none font-bold tracking-wide text-primary uppercase @md:block">
        {time}
      </span>
      {children}
    </div>
  );
}
const SCHEDULE_FRAMES = [
  { lane: 0, day: 1, lift: false, dropped: false },
  { lane: 0, day: 1, lift: true, dropped: false },
  { lane: 2, day: 3, lift: true, dropped: false },
  { lane: 2, day: 3, lift: false, dropped: true },
  { lane: 2, day: 3, lift: false, dropped: true },
] as const;
const SCHEDULE_MS = 1500;

function SchedulesVisual() {
  const { ref, step } = useLoopStep(SCHEDULE_FRAMES.length, SCHEDULE_MS);
  const frame = SCHEDULE_FRAMES[step];

  return (
    <Stage rootRef={ref} className="flex items-center justify-center p-4">
      <div className={cn(FLOAT_CARD, "w-full max-w-xl overflow-hidden")}>
        <div className="flex border-b border-border text-[11px] font-medium text-muted-foreground">
          <span className="w-12 shrink-0 @md:w-16" />
          {SCHEDULE_DAYS.map((day) => (
            <span key={day} className="flex-1 py-2 text-center">
              {day}
            </span>
          ))}
        </div>
        <div className="flex">
          <div className="w-12 shrink-0 @md:w-16">
            {SCHEDULE_LANES.map((lane) => (
              <div
                key={lane.name}
                className="flex h-14 items-center truncate px-2 text-[11px] font-medium"
              >
                {lane.name}
              </div>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            {SCHEDULE_LANES.map((lane) => (
              <div key={lane.name} className="relative flex h-14">
                {SCHEDULE_DAYS.map((day) => (
                  <span
                    key={day}
                    className="flex-1 border-t border-l border-border/60"
                  />
                ))}
                {lane.jobs.map((job) => (
                  <ScheduleEvent
                    key={job.label}
                    label={job.label}
                    time={job.time}
                    className="inset-y-2 border-border"
                    style={{ left: `calc(${job.day * 20}% + 0.5%)` }}
                  />
                ))}
              </div>
            ))}
            <ScheduleEvent
              label="Job 376"
              time={frame.lane ? "Thu 9 AM" : "Unassigned"}
              className={cn(
                "z-10 h-10 overflow-visible border-primary ring-3 ring-primary/10 transition-[top,left,transform,box-shadow] duration-1000 motion-reduce:transition-none",
                EASE,
                frame.lift ? "scale-110 shadow-2xl" : "shadow-md",
              )}
              style={{
                top: `calc(${frame.lane} * 3.5rem + 0.5rem)`,
                left: `calc(${frame.day * 20}% + 0.5%)`,
              }}
            >
              {frame.dropped ? (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1 animate-ping rounded-lg border-2 border-primary/50 [animation-iteration-count:1] motion-reduce:hidden"
                />
              ) : null}
              {frame.lift ? <Cursor className="-right-2 -bottom-2" /> : null}
            </ScheduleEvent>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** Invoices: a receipt prints out of a slot and gets stamped, beside its payment schedule. */
const INVOICE_LINES = [
  { name: "Original estimate", amount: "$2,440" },
  { name: "Approved extra", amount: "$95" },
  { name: "Deposit received", amount: "-$600" },
] as const;
const INVOICE_FRAMES = [
  { reveal: 12, paid: false, balance: 0, stage: 0 },
  { reveal: 45, paid: false, balance: 2440, stage: 0 },
  { reveal: 70, paid: false, balance: 2535, stage: 1 },
  { reveal: 100, paid: false, balance: 1935, stage: 2 },
  { reveal: 100, paid: true, balance: 0, stage: 3 },
  { reveal: 100, paid: true, balance: 0, stage: 3 },
] as const;
const INVOICE_STAGES = [
  "Created from the estimate",
  "Sent to customer",
  "Deposit received",
  "Paid in full",
] as const;
const INVOICES_MS = 1200;

function InvoicesVisual() {
  const { ref, step } = useLoopStep(INVOICE_FRAMES.length, INVOICES_MS);
  const frame = INVOICE_FRAMES[step];

  return (
    <Stage rootRef={ref} className="flex justify-center gap-6 px-4 pt-12">
      <div className="flex w-full max-w-68 flex-col items-center">
        <div className="relative z-10 h-3 w-full rounded-full bg-[#0b1a2e] shadow-lg" />
        <div className="-mt-1.5 h-76 w-[92%] overflow-hidden">
          <div
            className={cn(
              "rs-receipt relative bg-background px-5 pt-6 pb-8 shadow-xl",
              step > 0 && "transition-transform duration-1000",
              EASE,
            )}
            style={{ transform: `translateY(${frame.reveal - 100}%)` }}
          >
            <p className="text-center text-sm font-semibold tracking-tight">
              Summit Home Services
            </p>
            <p className="text-center text-[11px] text-muted-foreground">
              INV-874 · Olivia Hart
            </p>
            <ul className="mt-4 flex flex-col gap-2 border-y border-dashed border-border py-3 text-xs">
              {INVOICE_LINES.map((line) => (
                <li key={line.name} className="flex justify-between gap-2">
                  <span>{line.name}</span>
                  <span className="tabular-nums">{line.amount}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Balance due</span>
              <span className="text-2xl font-semibold tracking-tight">
                <CountUp value={frame.balance} format={dollars} ms={800} />
              </span>
            </div>
            <span
              className={cn(
                "absolute right-16 bottom-5 rotate-[-10deg] rounded-md border-2 border-primary px-3 py-1 text-sm font-bold tracking-widest text-primary transition-[transform,opacity] duration-500",
                EASE,
                frame.paid ? "scale-100 opacity-100" : "scale-[1.8] opacity-0",
              )}
            >
              PAID
            </span>
          </div>
        </div>
      </div>
      <ol
        className={cn(
          FLOAT_CARD,
          "hidden h-fit w-52 shrink-0 flex-col gap-3 p-4 @xl:flex",
        )}
      >
        {INVOICE_STAGES.map((label, index) => (
          <li key={label} className="flex items-center gap-2.5 text-[11px]">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                index <= frame.stage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent",
              )}
            >
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </span>
            <span
              className={cn(
                index <= frame.stage ? "font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
    </Stage>
  );
}

/** Payments: the card, a balance that closes, and each way of paying ticking off. */
const PAYMENT_METHODS = [
  {
    label: "Credit card",
    note: "Deposit",
    face: "•••• 4242",
    amount: 600,
    icon: CreditCard,
  },
  {
    label: "ACH",
    note: "Progress payment",
    face: "Bank transfer",
    amount: 900,
    icon: Landmark,
  },
  {
    label: "Check",
    note: "Progress payment",
    face: "No. 1187",
    amount: 900,
    icon: Receipt,
  },
  {
    label: "Cash",
    note: "Completion balance",
    face: "Received on site",
    amount: 600,
    icon: Banknote,
  },
] as const;
const PAYMENT_TOTAL = 3000;
/** Collected earlier this month, before INV-874's payments. */
const PAYMENT_MONTH = 15420;
const PAYMENTS_MS = 1800;

function PaymentsVisual() {
  const { ref, step } = useLoopStep(PAYMENT_METHODS.length, PAYMENTS_MS);
  const method = PAYMENT_METHODS[step];
  const collected = PAYMENT_METHODS.slice(0, step + 1).reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const paid = collected === PAYMENT_TOTAL;

  return (
    <Stage
      rootRef={ref}
      className="flex flex-col items-center justify-center gap-3 p-4 [perspective:1000px] @xl:flex-row @xl:gap-5"
    >
      <div className="flex w-full max-w-64 shrink-0 flex-col gap-3">
        <div
          className={cn(
            "flex h-36 flex-col justify-between rounded-2xl bg-linear-to-br from-primary to-[#02203f] p-4 text-white shadow-[0_24px_40px_-20px_rgba(2,16,36,0.7)] transition-transform duration-1000",
            EASE,
          )}
          style={{
            transform: `rotateY(${step % 2 ? 7 : -7}deg) rotateX(3deg)`,
          }}
        >
          <div className="flex items-center justify-between text-xs font-medium text-white/70">
            <span>Summit Home Services</span>
            <span className="h-5 w-7 rounded bg-white/25" />
          </div>
          <div key={method.label} className="animate-in fade-in duration-500">
            <p className="text-xl font-semibold tracking-tight">
              {method.label}
            </p>
            <p className="text-xs text-white/70">{method.face}</p>
          </div>
        </div>
        <div className={cn(FLOAT_CARD, "flex items-center gap-3 p-3")}>
          <Ring value={collected / PAYMENT_TOTAL} ms={1000} className="size-14">
            {paid ? (
              <Check
                className="size-5 text-primary"
                strokeWidth={3}
                aria-hidden="true"
              />
            ) : (
              <span className="text-[11px] font-semibold text-primary">
                <CountUp value={(collected / PAYMENT_TOTAL) * 100} ms={1000} />%
              </span>
            )}
          </Ring>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">INV-874 balance</p>
            <p className="text-xl font-semibold tracking-tight">
              <CountUp
                value={PAYMENT_TOTAL - collected}
                format={dollars}
                ms={1000}
              />
            </p>
          </div>
        </div>
      </div>

      <div className="hidden w-64 flex-col gap-3 @xl:flex">
        <ul className={cn(FLOAT_CARD, "divide-y divide-border")}>
          {PAYMENT_METHODS.map(({ label, note, amount, icon: Icon }, index) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 transition-colors duration-500 first:rounded-t-2xl last:rounded-b-2xl",
                index === step && "bg-primary/6",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {label}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {note}
                </span>
              </span>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums transition-opacity duration-500",
                  index <= step ? "opacity-100" : "opacity-30",
                )}
              >
                {dollars(amount)}
              </span>
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
                  index <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-transparent",
                )}
              >
                <Check
                  className="size-2.5"
                  strokeWidth={3.5}
                  aria-hidden="true"
                />
              </span>
            </li>
          ))}
        </ul>
        <div className={cn(FLOAT_CARD, "grid grid-cols-3 gap-2 p-3")}>
          {[
            {
              label: "This month",
              value: PAYMENT_MONTH + collected,
              format: dollars,
            },
            { label: "Payments", value: 41 + step + 1, format: whole },
            { label: "Avg. days", value: 4.2, format: oneDecimal },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="truncate text-[10px] text-muted-foreground">
                {stat.label}
              </p>
              <p className="truncate text-sm font-semibold tracking-tight">
                <CountUp value={stat.value} format={stat.format} ms={1000} />
              </p>
            </div>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap justify-center gap-1.5 @xl:hidden">
        {PAYMENT_METHODS.map(({ label, icon: Icon }, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors duration-500",
              index === step
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background",
            )}
          >
            <Icon className="size-3" aria-hidden="true" /> {label}
          </li>
        ))}
      </ul>
    </Stage>
  );
}

/**
 * Fixed services: a catalog grid with price tags; a booking lights up each card in turn.
 * Cards use live public fixed services (name, category, price, first photo) from the API;
 * the sample list below shows until they load, or if the request fails.
 */
type ServiceCard = {
  name: string;
  area: string;
  price: string;
  unit: string;
  icon: LucideIcon;
  image?: string;
};
const SERVICES: ServiceCard[] = [
  {
    name: "AC tune-up",
    area: "HVAC",
    price: "$129",
    unit: "visit",
    icon: Wind,
  },
  {
    name: "Furnace service",
    area: "HVAC",
    price: "$169",
    unit: "visit",
    icon: Flame,
  },
  {
    name: "Water heater flush",
    area: "Plumbing",
    price: "$160",
    unit: "job",
    icon: Droplets,
  },
  {
    name: "Drain cleaning",
    area: "Plumbing",
    price: "$117",
    unit: "job",
    icon: Wrench,
  },
  {
    name: "Outlet repair",
    area: "Electrical",
    price: "$95",
    unit: "job",
    icon: Plug,
  },
  {
    name: "Fan install",
    area: "Electrical",
    price: "$145",
    unit: "job",
    icon: Fan,
  },
];
const SERVICE_SLOTS = [
  "Mon 11:00 AM",
  "Thu 1:00 PM",
  "Fri 9:00 AM",
  "Tue 2:00 PM",
  "Wed 10:00 AM",
  "Fri 3:00 PM",
] as const;
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hvac: Wind,
  plumbing: Droplets,
  electrical: Plug,
};
const FIXED_MS = 1500;

/** Live services, fetched once per page load and shared by every mount of the tab. */
let liveServices: Promise<ServiceCard[]> | null = null;

function loadLiveServices() {
  liveServices ??= getData(
    publicApi.fixedServices,
    { page: 1, limit: 24 },
    { silent: true },
  )
    .then((response: unknown) => {
      const root = (response ?? {}) as { data?: unknown };
      const list = Array.isArray(root.data) ? root.data : [];
      const services = list
        .map(normalizePublicFixedService)
        .filter(
          (item): item is PublicFixedService =>
            Boolean(item) && Boolean(item?.images[0]) && item!.price > 0,
        );
      // One per category first, so the grid shows a spread of trades.
      const seen = new Set<string>();
      const spread = [
        ...services.filter((item) => {
          const key = item.category?.slug ?? item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
        ...services,
      ];
      const unique = [
        ...new Map(spread.map((item) => [item.id, item])).values(),
      ];
      return unique.slice(0, SERVICES.length).map((item): ServiceCard => ({
        name: item.servicesName,
        area: item.category?.name ?? "Service",
        price: dollars(item.price),
        unit: item.unit.replace(/^per\s+/i, "") || "job",
        icon: CATEGORY_ICONS[item.category?.slug ?? ""] ?? Wrench,
        image: item.images[0],
      }));
    })
    .catch(() => []);
  return liveServices;
}

function useServiceCards() {
  const [cards, setCards] = useState<ServiceCard[]>(SERVICES);
  useEffect(() => {
    let active = true;
    void loadLiveServices().then((live) => {
      if (active && live.length === SERVICES.length) setCards(live);
    });
    return () => {
      active = false;
    };
  }, []);
  return cards;
}

function FixedServicesVisual() {
  const { ref, step } = useLoopStep(SERVICES.length, FIXED_MS);
  const cards = useServiceCards();
  const booked = cards[step];

  return (
    <Stage rootRef={ref} className="flex flex-col gap-2.5 p-3 @md:p-4">
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 @md:grid-cols-3">
        {cards.map(({ name, area, price, unit, icon: Icon, image }, index) => (
          <div
            key={name}
            className={cn(
              FLOAT_CARD,
              "flex min-h-0 flex-col overflow-hidden transition-[border-color,transform,box-shadow] duration-500",
              EASE,
              index === step &&
                "-translate-y-0.5 border-primary shadow-[0_18px_40px_-18px_rgba(0,63,125,0.55)]",
            )}
          >
            <div className="relative min-h-0 flex-1 bg-primary/8">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- provider upload from our storage, sized by the card
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "absolute inset-0 size-full object-cover transition-transform duration-700",
                    EASE,
                    index === step && "scale-105",
                  )}
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-primary/40">
                  <Icon className="size-7" aria-hidden="true" />
                </span>
              )}
              <span className="absolute top-2 right-2 rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm">
                {price}
                <span className="font-normal">/{unit}</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 px-2.5 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-500",
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold tracking-tight">
                  {name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {area}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        key={booked.name}
        className="animate-in fade-in slide-in-from-bottom-2 mx-auto flex max-w-full shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg duration-500"
      >
        <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          New booking · {booked.name} · {SERVICE_SLOTS[step]}
        </span>
      </div>
    </Stage>
  );
}

function AiReceptionistVisual() {
  return (
    <div className="flex size-full items-center justify-center p-4">
      <ReceptionistCallCard />
    </div>
  );
}

/** Reports: a line chart draws itself on a floating card beside a phone with the key numbers. */
const CHART_LINE =
  "M0 92 C 30 86, 44 70, 70 72 S 110 54, 140 56 S 190 30, 220 32 S 270 8, 300 6";
const CHART_AREA = `${CHART_LINE} V 110 H 0 Z`;
const REPORT_FUNNEL = [
  { label: "Quote requests", value: 100 },
  { label: "Estimates sent", value: 62 },
  { label: "Accepted", value: 38 },
] as const;
const REPORTS_MS = 2000;
const REPORTS_STEPS = 3;

function ReportsVisual() {
  const { ref, step } = useLoopStep(REPORTS_STEPS, REPORTS_MS);
  const drawn = step > 0;
  const countMs = drawn ? 1800 : 1;

  return (
    <Stage rootRef={ref} className="flex items-center justify-center p-4">
      <div className={cn(FLOAT_CARD, "w-full max-w-md p-4 @md:mr-16 @md:p-5")}>
        <p className="text-xs text-muted-foreground">Collected · Jun–Nov</p>
        <p className="text-3xl font-semibold tracking-tight">
          <CountUp value={drawn ? 35800 : 0} format={dollars} ms={countMs} />
        </p>
        <svg
          viewBox="0 0 300 110"
          className="mt-3 h-36 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="rs-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={CHART_AREA}
            fill="url(#rs-chart-fill)"
            className={cn(
              "transition-opacity",
              drawn
                ? "opacity-100 delay-500 duration-1000"
                : "opacity-0 duration-0",
            )}
          />
          <path
            d={CHART_LINE}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={drawn ? 0 : 1}
            className={cn(
              "stroke-primary",
              drawn &&
                "transition-[stroke-dashoffset] duration-1800 ease-in-out",
            )}
          />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
      <PhoneFrame className="absolute right-5 hidden h-76 w-40 @xl:block">
        <div className="flex h-full flex-col gap-3 px-3 pt-8">
          <p className="text-[11px] text-muted-foreground">
            Estimate conversion
          </p>
          <p className="-mt-2 text-2xl font-semibold tracking-tight">
            <CountUp value={drawn ? 59 : 0} ms={countMs} />%
          </p>
          <ul className="flex flex-col gap-2.5">
            {REPORT_FUNNEL.map((item) => (
              <li key={item.label} className="text-[10px]">
                <span>{item.label}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-primary/10">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-primary",
                      drawn && "transition-[width] duration-1500",
                      EASE,
                    )}
                    style={{ width: drawn ? `${item.value}%` : "0%" }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </PhoneFrame>
    </Stage>
  );
}

/** Each tab's visual, and how long one pass takes (the tabs wait this long before moving on). */
export const DASHBOARD_MOCKS: Record<
  string,
  { Mock: ComponentType; loopMs: number }
> = {
  dashboard: { Mock: DashboardVisual, loopMs: DASH_FRAMES.length * DASH_MS },
  pipeline: {
    Mock: PipelineVisual,
    loopMs: PIPELINE_FRAMES.length * PIPELINE_MS,
  },
  customers: {
    Mock: CustomersVisual,
    loopMs: CUSTOMER_CARDS.length * CUSTOMERS_MS,
  },
  employees: { Mock: EmployeesVisual, loopMs: CREW.length * EMPLOYEES_MS },
  timesheets: {
    Mock: TimesheetsVisual,
    loopMs: TIME_FRAMES.length * TIMESHEETS_MS,
  },
  leads: { Mock: LeadsVisual, loopMs: LEAD_FEED.length * LEADS_MS },
  estimates: { Mock: EstimateVisual, loopMs: ESTIMATE_STEPS * ESTIMATE_MS },
  jobs: { Mock: JobsVisual, loopMs: JOB_STAGES.length * JOBS_MS },
  schedules: {
    Mock: SchedulesVisual,
    loopMs: SCHEDULE_FRAMES.length * SCHEDULE_MS,
  },
  invoices: {
    Mock: InvoicesVisual,
    loopMs: INVOICE_FRAMES.length * INVOICES_MS,
  },
  payments: {
    Mock: PaymentsVisual,
    loopMs: PAYMENT_METHODS.length * PAYMENTS_MS,
  },
  "fixed-services": {
    Mock: FixedServicesVisual,
    loopMs: SERVICES.length * FIXED_MS,
  },
  "ai-receptionist": { Mock: AiReceptionistVisual, loopMs: CALL_LOOP_MS },
  reports: { Mock: ReportsVisual, loopMs: REPORTS_STEPS * REPORTS_MS },
};
