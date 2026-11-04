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
  Clock,
  CreditCard,
  Droplets,
  Fan,
  FilePlus2,
  Flame,
  Globe,
  Landmark,
  MapPin,
  MessageCircle,
  MousePointer2,
  Navigation,
  Package,
  Phone,
  Plug,
  Receipt,
  Search,
  ShieldCheck,
  Store,
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
        .join("")
        .slice(0, 2)}
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
/** Tate's day as the Timesheets frames play: label, time, and the step it appears at. */
const TIME_SESSIONS = [
  ["Clocked in", "7:00 AM · shop", 1],
  ["Started JOB-983", "9:41 AM · Furnace cleaning", 1],
  ["Break", "12:00 – 12:30 PM", 2],
  ["Clocked out", "3:30 PM · 8.0 h", 4],
] as const;

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
      {/* Wide stages: Tate's sessions so far and the pay period. */}
      <div className="hidden h-89 w-52 flex-col gap-3 @2xl:flex">
        <div className={cn(FLOAT_CARD, "min-h-0 flex-1 p-4")}>
          <p className="text-xs font-semibold">Sessions today</p>
          {step === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
              Not clocked in yet · shift starts 7:00 AM
            </p>
          ) : null}
          <ol className="mt-2.5 flex flex-col gap-1.5 border-l border-border pl-3">
            {TIME_SESSIONS.map(([label, time, from]) =>
              step >= from ? (
                <li
                  key={label}
                  className="animate-in fade-in slide-in-from-left-1 relative text-[11px] duration-500"
                >
                  <span className="absolute top-1 -left-[15.5px] size-2 rounded-full bg-primary ring-2 ring-background" />
                  <span className="block font-medium">{label}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {time}
                  </span>
                </li>
              ) : null,
            )}
          </ol>
        </div>
        <div className={cn(FLOAT_CARD, "shrink-0 p-4")}>
          <p className="text-xs font-semibold">Pay period</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div>
              <dt className="text-[10px] text-muted-foreground">Hours</dt>
              <dd className="font-semibold">
                <CountUp
                  value={WEEK_HOURS + frame.hours}
                  format={oneDecimal}
                  ms={1500}
                />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Overtime</dt>
              <dd className="font-semibold">0.0</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">To pay</dt>
              <dd className="font-semibold">
                <CountUp
                  value={(WEEK_HOURS + frame.hours) * PAY_RATE}
                  format={dollars}
                  ms={1500}
                />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Pay date</dt>
              <dd className="font-semibold">Fri, Nov 7</dd>
            </div>
          </dl>
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

/**
 * The Dashboard layout shared by the sidebar-option visuals below: a row of stat tiles, then a main
 * card beside a column of smaller cards, together filling the stage. Phones keep two tiles and
 * the main card.
 */
function StatRow({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 @md:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            FLOAT_CARD,
            "px-3 py-2.5",
            index > 1 && "hidden @md:block",
          )}
        >
          <p className="truncate text-[11px] text-muted-foreground">
            {stat.label}
          </p>
          <p className="truncate text-xl font-semibold tracking-tight">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function BoardLayout({
  rootRef,
  stats,
  main,
  side,
}: {
  rootRef: React.Ref<HTMLDivElement>;
  stats: { label: string; value: ReactNode }[];
  main: ReactNode;
  side: ReactNode;
}) {
  return (
    <Stage rootRef={rootRef} className="flex flex-col gap-2.5 p-3 @md:p-4">
      <StatRow stats={stats} />
      <div className="grid min-h-0 flex-1 gap-2.5 @md:grid-cols-[1.25fr_1fr]">
        {main}
        <div className="hidden min-h-0 flex-col gap-2.5 @md:flex">{side}</div>
      </div>
    </Stage>
  );
}

/** A card with a title bar; `fill` lets it take the remaining height of its column. */
function Panel({
  title,
  aside,
  fill,
  className,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        FLOAT_CARD,
        "flex min-h-0 flex-col overflow-hidden",
        fill && "flex-1",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="truncate text-xs font-semibold">{title}</p>
        {aside ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Dot({ tone }: { tone: "on" | "go" | "off" | "warn" }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-colors duration-500",
        tone === "on" && "bg-emerald-500",
        tone === "go" && "bg-primary",
        tone === "warn" && "bg-amber-500",
        tone === "off" && "bg-muted-foreground/40",
      )}
    />
  );
}

/** Contractors: a sub's compliance checklist ticks off, then they're assigned to a job. */
const CONTRACTOR_CHECKS = [
  ["License on file", "EC-48211 · exp. Mar 2027"],
  ["Insurance current", "General liability · $1M"],
  ["W-9 received", "Uploaded Oct 12"],
] as const;
const SUBS = [
  ["Ruiz Electric LLC", "Electrical"],
  ["Peak Roofing", "Roofing"],
  ["Clearline Drywall", "Drywall"],
  ["Northside HVAC", "HVAC"],
] as const;
const CONTRACTORS_STEPS = CONTRACTOR_CHECKS.length + 2;
const CONTRACTORS_MS = 1300;

function ContractorsVisual() {
  const { ref, step } = useLoopStep(CONTRACTORS_STEPS, CONTRACTORS_MS);
  const assigned = step === CONTRACTORS_STEPS - 1;

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Active subs", value: "6" },
        { label: "On jobs today", value: <CountUp value={assigned ? 3 : 2} /> },
        {
          label: "Hours this week",
          value: <CountUp value={assigned ? 46.5 : 40} format={oneDecimal} />,
        },
        {
          label: "Pay owed",
          value: <CountUp value={assigned ? 3720 : 3200} format={dollars} />,
        },
      ]}
      main={
        <div className={cn(FLOAT_CARD, "flex min-h-0 flex-col p-4")}>
          <div className="flex items-center gap-3">
            <Initials name="Ruiz Electric" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                Ruiz Electric LLC
              </p>
              <p className="text-xs text-muted-foreground">
                Electrical · Subcontractor
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              $40/hr
            </span>
          </div>
          <ul className="mt-3 flex flex-1 flex-col justify-center gap-2">
            {CONTRACTOR_CHECKS.map(([label, detail], index) => {
              const done = step > index;
              return (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors duration-500",
                    done
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-500",
                      EASE,
                      done
                        ? "scale-100 bg-emerald-500 text-white"
                        : "scale-90 bg-muted",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block font-medium",
                        !done && "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div
            className={cn(
              "mt-3 flex shrink-0 items-center justify-between rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground transition-[opacity,translate] duration-700",
              EASE,
              assigned
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            )}
          >
            <span className="font-medium">JOB-376 · Panel upgrade</span>
            <span className="text-[10px] font-semibold uppercase">
              Assigned
            </span>
          </div>
        </div>
      }
      side={
        <>
          <Panel title="Subcontractors" aside="6 total" fill>
            <ul className="grid flex-1 auto-rows-fr divide-y divide-border">
              {SUBS.map(([name, trade], index) => (
                <li
                  key={name}
                  className="flex items-center gap-2 px-3 text-[11px]"
                >
                  <Initials name={name} className="size-5 text-[8px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {trade}
                    </span>
                  </span>
                  <Dot
                    tone={
                      index === 0
                        ? step >= CONTRACTOR_CHECKS.length
                          ? "on"
                          : "warn"
                        : "on"
                    }
                  />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Assignments" className="shrink-0">
            <ul className="flex flex-col gap-1.5 p-3 text-[11px]">
              <li
                className={cn(
                  "flex justify-between transition-colors duration-500",
                  assigned
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                <span>JOB-376 · Ruiz Electric</span>
                <span>{assigned ? "Today" : "Open"}</span>
              </li>
              <li className="flex justify-between text-muted-foreground">
                <span>JOB-381 · Peak Roofing</span>
                <span>Thu</span>
              </li>
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Vendors: a purchase order fills in line by line, then goes out and comes back received. */
const PO_LINES = [
  ["3/4 in. copper pipe × 20", 184],
  ["Ball valve × 6", 57],
  ["50 gal water heater", 689],
  ["Expansion tank", 74],
  ["Flex connectors × 4", 38],
] as const;
const PO_STEPS = PO_LINES.length + 2;
const VENDORS_MS = 1000;

function VendorsVisual() {
  const { ref, step } = useLoopStep(PO_STEPS, VENDORS_MS);
  const shown = Math.min(step, PO_LINES.length);
  const total = PO_LINES.slice(0, shown).reduce(
    (sum, [, cost]) => sum + cost,
    0,
  );
  const status =
    step >= PO_STEPS - 1 ? "Received" : step >= PO_STEPS - 2 ? "Sent" : "Draft";

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Vendors", value: "12" },
        { label: "Open POs", value: status === "Received" ? "2" : "3" },
        {
          label: "Spent this month",
          value: <CountUp value={7380 + total} format={dollars} />,
        },
        { label: "Due this week", value: "$1,260" },
      ]}
      main={
        <div className={cn(FLOAT_CARD, "flex min-h-0 flex-col p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">PO-1042</p>
              <p className="text-xs text-muted-foreground">
                Metro Supply Co. · for JOB-376
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-500",
                status === "Received"
                  ? "bg-emerald-500/10 text-emerald-700"
                  : status === "Sent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {status}
            </span>
          </div>
          <ul className="mt-3 flex flex-1 flex-col gap-2 border-t border-border pt-3">
            {PO_LINES.slice(0, shown).map(([label, cost]) => (
              <li
                key={label}
                className="animate-in fade-in slide-in-from-left-2 flex items-center justify-between text-xs duration-500"
              >
                <span className="flex items-center gap-2">
                  <Package
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {label}
                </span>
                <span className="tabular-nums">{dollars(cost)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total</span>
            <CountUp value={total} format={dollars} />
          </div>
        </div>
      }
      side={
        <>
          <Panel title="Metro Supply Co." className="shrink-0">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 text-[11px]">
              {[
                ["Terms", "Net 30"],
                ["Account", "#40-2291"],
                ["Contact", "Dana Ruiz"],
                ["Balance", "$1,260"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Recent POs" fill>
            <ul className="grid flex-1 auto-rows-fr divide-y divide-border">
              {[
                ["PO-1041", "Received", "$412"],
                ["PO-1040", "Paid", "$1,180"],
                ["PO-1039", "Paid", "$96"],
              ].map(([number, state, amount]) => (
                <li
                  key={number}
                  className="flex items-center gap-2 px-3 text-[11px]"
                >
                  <span className="font-medium">{number}</span>
                  <span className="flex-1 text-muted-foreground">{state}</span>
                  <span className="tabular-nums">{amount}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Employee tracking: a tech drives the route to the job; the geofence confirms arrival. */
const ROUTE = [
  [12, 78],
  [30, 70],
  [46, 48],
  [66, 40],
  [82, 24],
] as const;
const TRACKING_STEPS = ROUTE.length + 1;
const TRACKING_MS = 1100;

function TrackingVisual() {
  const { ref, step } = useLoopStep(TRACKING_STEPS, TRACKING_MS);
  const at = ROUTE[Math.min(step, ROUTE.length - 1)];
  const arrived = step >= ROUTE.length - 1;
  const minutes = Math.max(0, (ROUTE.length - 1 - step) * 3);

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "On the clock", value: "5" },
        { label: "On site", value: <CountUp value={arrived ? 4 : 3} /> },
        { label: "En route", value: <CountUp value={arrived ? 0 : 1} /> },
        { label: "Miles today", value: <CountUp value={30 + step * 3} /> },
      ]}
      main={
        <div
          className={cn(
            FLOAT_CARD,
            "relative min-h-0 overflow-hidden bg-[radial-gradient(circle,rgba(0,63,125,0.08)_1px,transparent_1px)] bg-size-[14px_14px]",
          )}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden="true"
          >
            <path
              d="M0 60 H100 M0 30 H100 M40 0 V100 M72 0 V100"
              className="stroke-primary/10"
              strokeWidth="3"
              fill="none"
            />
            <polyline
              points={ROUTE.map(([x, y]) => `${x},${y}`).join(" ")}
              className="stroke-primary/40"
              strokeWidth="1.2"
              strokeDasharray="3 2"
              fill="none"
            />
          </svg>
          {/* Geofence around the job site */}
          <span
            className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/50 bg-emerald-500/10"
            style={{ left: "82%", top: "24%" }}
          >
            {arrived ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
            ) : null}
          </span>
          <MapPin
            className="absolute size-5 -translate-x-1/2 -translate-y-full fill-background text-emerald-600"
            style={{ left: "82%", top: "24%" }}
            aria-hidden="true"
          />
          <span
            className={cn(
              "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20 transition-[left,top] duration-1000",
              EASE,
            )}
            style={{ left: `${at[0]}%`, top: `${at[1]}%` }}
          >
            <Navigation className="size-3.5 fill-current" aria-hidden="true" />
          </span>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-background/95 px-3 py-2 text-xs shadow-sm">
            <span className="font-medium">Tate Fischer · JOB-983</span>
            <span
              className={cn(
                "font-semibold transition-colors duration-500",
                arrived ? "text-emerald-600" : "text-primary",
              )}
            >
              {arrived ? "Arrived · on site" : `${minutes} min away`}
            </span>
          </div>
        </div>
      }
      side={
        <>
          <Panel title="Crew now" aside="Live" className="shrink-0">
            <ul className="flex flex-col gap-2 p-3 text-[11px]">
              {[
                ["Tate Fischer", arrived ? "On site" : "En route"],
                ["Maria Lee", "On site"],
                ["Jordan Burt", "On site"],
                ["Sam Ortiz", "Clocked out"],
              ].map(([name, state]) => (
                <li key={name} className="flex items-center gap-2">
                  <Initials name={name} className="size-5 text-[8px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {state}
                  </span>
                  <Dot
                    tone={
                      state === "On site"
                        ? "on"
                        : state === "En route"
                          ? "go"
                          : "off"
                    }
                  />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Arrivals today" fill>
            <ul className="flex flex-col gap-1.5 p-3 text-[11px]">
              {arrived ? (
                <li className="animate-in fade-in slide-in-from-top-2 flex justify-between font-medium text-emerald-700 duration-500">
                  <span>Tate · JOB-983</span>
                  <span>9:41 AM ✓</span>
                </li>
              ) : null}
              <li className="flex justify-between text-muted-foreground">
                <span>Jordan · JOB-372</span>
                <span>8:30 AM ✓</span>
              </li>
              <li className="flex justify-between text-muted-foreground">
                <span>Maria · JOB-376</span>
                <span>8:02 AM ✓</span>
              </li>
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Reminders: the next follow-up rings, gets done, and the queue moves on. */
const REMINDERS = [
  ["Call Olivia about EST-584", "9:00 AM"],
  ["Order parts for JOB-376", "11:30 AM"],
  ["Follow up on INV-874", "2:00 PM"],
  ["Confirm Friday's site visit", "4:15 PM"],
] as const;
const REMINDERS_STEPS = REMINDERS.length + 1;
const REMINDERS_MS = 1400;

function RemindersVisual() {
  const { ref, step } = useLoopStep(REMINDERS_STEPS, REMINDERS_MS);
  const done = Math.min(step, REMINDERS.length);

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        {
          label: "Due today",
          value: <CountUp value={REMINDERS.length - done} />,
        },
        { label: "Done today", value: <CountUp value={done} /> },
        { label: "This week", value: "11" },
        { label: "Overdue", value: "0" },
      ]}
      main={
        <Panel
          title="Today's reminders"
          aside={`${done}/${REMINDERS.length} done`}
        >
          <ul className="grid flex-1 auto-rows-fr gap-2 p-3">
            {REMINDERS.map(([label, time], index) => {
              const finished = index < step;
              const ringing = index === step;
              return (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 text-xs transition-[border-color,background-color,opacity] duration-500",
                    ringing
                      ? "border-primary/40 bg-primary/5"
                      : "border-border",
                    finished && "opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
                      finished
                        ? "bg-emerald-500 text-white"
                        : ringing
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {finished ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Bell
                        className={cn("size-3.5", ringing && "rs-bell-ring")}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium",
                      finished && "line-through",
                    )}
                  >
                    {label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums",
                      ringing
                        ? "font-semibold text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {ringing ? "Due now" : time}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      }
      side={
        <>
          <Panel title="Tomorrow" aside="3" className="shrink-0">
            <ul className="flex flex-col gap-1.5 p-3 text-[11px] text-muted-foreground">
              {[
                ["Send EST-590 to Grace", "9:00"],
                ["Check JOB-381 photos", "1:00"],
                ["Renew Peak Roofing COI", "3:30"],
              ].map(([label, time]) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="truncate">{label}</span>
                  <span className="tabular-nums">{time}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Linked to" fill>
            <ul className="flex flex-1 flex-col justify-center gap-2.5 p-3 text-[11px]">
              {[
                ["Customers", 5],
                ["Jobs", 4],
                ["Invoices", 2],
              ].map(([label, count]) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="w-16 text-muted-foreground">{label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(Number(count) / 5) * 100}%` }}
                    />
                  </span>
                  <span className="w-4 text-right tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Messages: a customer conversation types itself out, bubble by bubble. */
const CHAT = [
  { from: "customer", text: "Hi! Is Thursday morning still good?" },
  { from: "pro", text: "Yes, Tate will be there at 9 AM." },
  { from: "customer", text: "Great. Can he check the water heater too?" },
  { from: "pro", text: "Sure, I've added it to the job." },
] as const;
const THREADS = [
  ["Olivia Hart", "Thanks, see you then!", 0],
  ["Ava Mitchell", "Can you send the estimate?", 2],
  ["Liam Foster", "Photos attached", 1],
] as const;
const MESSAGES_MS = 1500;

function MessagesVisual() {
  const { ref, step } = useLoopStep(CHAT.length + 1, MESSAGES_MS);
  const typing = step < CHAT.length ? CHAT[step] : null;

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Unread", value: <CountUp value={Math.max(1, 4 - step)} /> },
        { label: "Open chats", value: "18" },
        { label: "Avg. reply", value: "12 min" },
        { label: "Team chats", value: "4" },
      ]}
      main={
        <div className={cn(FLOAT_CARD, "flex min-h-0 flex-col p-3")}>
          <div className="flex shrink-0 items-center gap-2 border-b border-border pb-2.5">
            <Initials name="Noah Bennett" className="size-7 text-[10px]" />
            <div className="leading-tight">
              <p className="text-xs font-semibold">Noah Bennett</p>
              <p className="text-[10px] text-emerald-600">Online · JOB-376</p>
            </div>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden pt-2">
            {CHAT.slice(0, step).map((message) => (
              <li
                key={message.text}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2 max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-snug duration-500",
                  message.from === "pro"
                    ? "self-end rounded-br-md bg-primary text-primary-foreground"
                    : "self-start rounded-bl-md bg-muted",
                )}
              >
                {message.text}
              </li>
            ))}
            {typing ? (
              <li
                key={`typing-${step}`}
                className={cn(
                  "animate-in fade-in flex gap-1 rounded-2xl px-3 py-2.5 duration-300",
                  typing.from === "pro"
                    ? "self-end bg-primary/15"
                    : "self-start bg-muted",
                )}
                aria-hidden="true"
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 animate-bounce rounded-full bg-foreground/40"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </li>
            ) : null}
          </ul>
          <p className="mt-2 shrink-0 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">
            Write a message…
          </p>
        </div>
      }
      side={
        <>
          <Panel title="Customers & leads" aside="18" fill>
            <ul className="grid flex-1 auto-rows-fr divide-y divide-border">
              {THREADS.map(([name, last, unread]) => (
                <li
                  key={name}
                  className="flex items-center gap-2 px-3 text-[11px]"
                >
                  <Initials name={name} className="size-6 text-[9px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {last}
                    </span>
                  </span>
                  {unread ? (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                      {unread}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Technicians" className="shrink-0">
            <ul className="flex flex-col gap-1.5 p-3 text-[11px]">
              <li className="flex justify-between gap-2">
                <span className="font-medium">Tate Fischer</span>
                <span className="truncate text-muted-foreground">
                  On my way
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="font-medium">Maria Lee</span>
                <span className="truncate text-muted-foreground">
                  Done at JOB-376
                </span>
              </li>
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Tasks: the day's list gets checked off and the progress bar fills. */
const TASKS = [
  ["Pick up permit for JOB-376", "Tate Fischer", "Today"],
  ["Upload site photos", "Maria Lee", "Today"],
  ["Send revised estimate EST-588", "Jordan Burt", "Wed"],
  ["Return unused fittings", "Sam Ortiz", "Thu"],
  ["Book follow-up visit", "Maria Lee", "Fri"],
] as const;
const TASKS_MS = 1200;

function TasksVisual() {
  const { ref, step } = useLoopStep(TASKS.length + 1, TASKS_MS);
  const done = Math.min(step, TASKS.length);
  const percent = (done / TASKS.length) * 100;

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        {
          label: "Open tasks",
          value: <CountUp value={TASKS.length - done + 7} />,
        },
        { label: "Done this week", value: <CountUp value={done + 9} /> },
        { label: "Overdue", value: <CountUp value={done >= 2 ? 0 : 1} /> },
        { label: "Assigned", value: "4 people" },
      ]}
      main={
        <Panel
          title="Tasks · this week"
          aside={
            <span className="font-semibold text-primary">
              <CountUp value={percent} />%
            </span>
          }
        >
          <div className="px-3 pt-2.5">
            <span className="block h-1.5 overflow-hidden rounded-full bg-primary/10">
              <span
                className={cn(
                  "block h-full rounded-full bg-primary transition-[width] duration-700",
                  EASE,
                )}
                style={{ width: `${percent}%` }}
              />
            </span>
          </div>
          <ul className="grid flex-1 auto-rows-fr px-2 pb-1">
            {TASKS.map(([label, owner, due], index) => {
              const checked = index < done;
              return (
                <li
                  key={label}
                  className="flex items-center gap-3 px-1 text-xs"
                >
                  <span
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors duration-300",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {checked ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    <span className="relative">
                      {label}
                      <span
                        className={cn(
                          "absolute inset-x-0 top-1/2 h-px origin-left bg-muted-foreground transition-transform duration-500",
                          checked ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {due}
                  </span>
                  <Initials name={owner} className="size-5 text-[8px]" />
                </li>
              );
            })}
          </ul>
        </Panel>
      }
      side={
        <>
          <Panel title="By person" fill>
            <ul className="flex flex-1 flex-col justify-center gap-2.5 p-3 text-[11px]">
              {[
                ["Maria Lee", 2],
                ["Tate Fischer", 1],
                ["Jordan Burt", 1],
                ["Sam Ortiz", 1],
              ].map(([name, total], index) => {
                const owned = TASKS.filter(([, owner]) => owner === name);
                const closed = owned.filter(
                  (task) => TASKS.indexOf(task) < done,
                ).length;
                return (
                  <li key={name} className="flex items-center gap-2">
                    <Initials
                      name={String(name)}
                      className="size-5 text-[8px]"
                    />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-700"
                        style={{
                          width: `${(closed / Number(total)) * 100}%`,
                          transitionDelay: `${index * 60}ms`,
                        }}
                      />
                    </span>
                    <span className="w-7 text-right tabular-nums">
                      {closed}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Next up" className="shrink-0">
            <p className="p-3 text-[11px]">
              <span className="font-medium">
                {done < TASKS.length ? TASKS[done][0] : "All caught up"}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {done < TASKS.length
                  ? `${TASKS[done][1]} · ${TASKS[done][2]}`
                  : "Nothing left this week"}
              </span>
            </p>
          </Panel>
        </>
      }
    />
  );
}

/** Fixed service orders: a booking comes in, gets accepted, scheduled, and completed. */
const ORDER_STAGES = ["New", "Accepted", "Scheduled", "Completed"] as const;
const ORDERS_MS = 1500;

function OrdersVisual() {
  const { ref, step } = useLoopStep(ORDER_STAGES.length, ORDERS_MS);

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "New orders", value: <CountUp value={step === 0 ? 4 : 3} /> },
        {
          label: "This month",
          value: <CountUp value={step === 3 ? 2940 : 2811} format={dollars} />,
        },
        { label: "Scheduled", value: <CountUp value={step >= 2 ? 6 : 5} /> },
        { label: "Avg. order", value: "$118" },
      ]}
      main={
        <div className={cn(FLOAT_CARD, "relative flex min-h-0 flex-col p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">
                AC tune-up · $129
              </p>
              <p className="text-xs text-muted-foreground">
                Olivia Hart · Thu, 9:00 AM
              </p>
            </div>
            <span
              key={step}
              className="animate-in zoom-in-90 fade-in rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary duration-300"
            >
              {ORDER_STAGES[step]}
            </span>
          </div>
          <ol className="mt-4 grid grid-cols-4 gap-1.5">
            {ORDER_STAGES.map((stage, index) => (
              <li key={stage} className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-colors duration-500",
                    index <= step ? "bg-primary" : "bg-primary/10",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px]",
                    index <= step ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {stage}
                </span>
              </li>
            ))}
          </ol>
          <dl className="mt-4 grid flex-1 grid-cols-2 content-center gap-x-3 gap-y-2.5 rounded-xl bg-primary/4 p-3 text-[11px]">
            {[
              ["Address", "2217 Maple St, Aurora"],
              ["Payment", step === 3 ? "Paid · card" : "Card on file"],
              ["Technician", step >= 2 ? "Tate Fischer" : "Not assigned"],
              ["Note", "Gate code 4417"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 text-xs font-semibold">
            <span className="rounded-lg border border-border py-2 text-center text-muted-foreground">
              Decline
            </span>
            <span
              className={cn(
                "rounded-lg py-2 text-center transition-colors duration-500",
                step === 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-emerald-500/10 text-emerald-700",
              )}
            >
              {step === 0 ? "Accept" : "Accepted"}
            </span>
          </div>
          <Cursor
            className={cn(
              "transition-[right,bottom,opacity] duration-700",
              step === 0
                ? "right-14 bottom-5 opacity-100"
                : "right-6 bottom-1 opacity-0",
            )}
          />
        </div>
      }
      side={
        <>
          <Panel title="New orders" aside="3" fill>
            <ul className="grid flex-1 auto-rows-fr divide-y divide-border">
              {[
                ["Drain cleaning", "Ava Mitchell", "$149"],
                ["Outlet install", "Liam Foster", "$95"],
                ["Furnace check", "Grace Kim", "$110"],
              ].map(([service, customer, price]) => (
                <li
                  key={service}
                  className="flex items-center gap-2 px-3 text-[11px]"
                >
                  <Dot tone="go" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {service}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {customer}
                    </span>
                  </span>
                  <span className="tabular-nums">{price}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Today" className="shrink-0">
            <ul className="flex flex-col gap-1.5 p-3 text-[11px] text-muted-foreground">
              <li className="flex justify-between">
                <span>Water heater flush</span>
                <span>10:30</span>
              </li>
              <li className="flex justify-between">
                <span>Leak check</span>
                <span>2:00</span>
              </li>
            </ul>
          </Panel>
        </>
      }
    />
  );
}

/** Business Profile: the public profile builds itself up, piece by piece. */
const PROFILE_STEPS = 5;
const PROFILE_MS = 1100;
const PROFILE_CHECKLIST = [
  "Logo and cover",
  "License and insurance",
  "Services listed",
  "Hours and areas",
  "Quote button live",
] as const;

function ProfileVisual() {
  const { ref, step } = useLoopStep(PROFILE_STEPS, PROFILE_MS);
  const piece = (from: number) =>
    cn(
      "transition-[opacity,translate] duration-700",
      EASE,
      step >= from ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
    );

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Profile views", value: <CountUp value={1180 + step * 23} /> },
        { label: "Quote requests", value: <CountUp value={16 + step} /> },
        { label: "Services listed", value: "9" },
        { label: "Service areas", value: "4" },
      ]}
      main={
        <div
          className={cn(FLOAT_CARD, "flex min-h-0 flex-col overflow-hidden")}
        >
          <div className="h-12 shrink-0 bg-linear-to-r from-primary to-sky-500" />
          <div className="-mt-6 flex min-h-0 flex-1 flex-col px-4 pb-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary text-primary-foreground">
              <Store className="size-5" aria-hidden="true" />
            </span>
            <div className={cn("mt-1.5", piece(0))}>
              <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                Summit Plumbing Co.
                <BadgeCheck
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
              </p>
              <p className="text-xs text-muted-foreground">
                Plumbing · Aurora, IL
              </p>
            </div>
            <div className={cn("mt-2.5 flex flex-wrap gap-1.5", piece(1))}>
              {["Licensed", "Insured", "Verified"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                >
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
            <div className={cn("mt-2.5 flex flex-wrap gap-1.5", piece(2))}>
              {[
                "Water heaters",
                "Drain cleaning",
                "Leak repair",
                "Repiping",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px]"
                >
                  {label}
                </span>
              ))}
            </div>
            <p
              className={cn(
                "mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground",
                piece(3),
              )}
            >
              <Clock className="size-3.5" aria-hidden="true" />
              Mon–Sat · 7:00 AM – 6:00 PM · Aurora, Naperville +2
            </p>
            <span
              className={cn(
                "mt-auto block rounded-lg bg-primary py-2 text-center text-xs font-semibold text-primary-foreground",
                piece(4),
              )}
            >
              Request a quote
            </span>
          </div>
        </div>
      }
      side={
        <>
          <Panel
            title="Profile checklist"
            aside={`${Math.min(step + 1, PROFILE_CHECKLIST.length)}/${PROFILE_CHECKLIST.length}`}
            fill
          >
            <ul className="grid flex-1 auto-rows-fr px-3 py-1">
              {PROFILE_CHECKLIST.map((label, index) => {
                const ready = index <= step;
                return (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
                        ready ? "bg-emerald-500 text-white" : "bg-muted",
                      )}
                    >
                      {ready ? (
                        <Check className="size-2.5" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className={cn(!ready && "text-muted-foreground")}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <div
            className={cn(
              FLOAT_CARD,
              "flex shrink-0 items-center gap-2 px-3 py-2.5 text-[11px] font-medium",
            )}
          >
            <Dot tone={step >= PROFILE_STEPS - 1 ? "on" : "off"} />
            {step >= PROFILE_STEPS - 1
              ? "Live on Request Service"
              : "Draft · not public yet"}
          </div>
        </>
      }
    />
  );
}

/** Portfolio: past-work photos, with the spotlight moving from one project to the next. */
const PORTFOLIO = [
  [
    "Kitchen remodel",
    "Aurora · 18 photos",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=400&q=70",
  ],
  [
    "Bathroom refresh",
    "Naperville · 12 photos",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=400&q=70",
  ],
  [
    "Panel upgrade",
    "Batavia · 6 photos",
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=400&q=70",
  ],
  [
    "Deck build",
    "Oswego · 22 photos",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=70",
  ],
  [
    "Interior paint",
    "Aurora · 9 photos",
    "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=400&q=70",
  ],
  [
    "Roof repair",
    "Naperville · 14 photos",
    "https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=400&q=70",
  ],
] as const;
const PORTFOLIO_MS = 1400;

function PortfolioVisual() {
  const { ref, step } = useLoopStep(PORTFOLIO.length, PORTFOLIO_MS);
  const [title, meta] = PORTFOLIO[step];

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Projects", value: "24" },
        { label: "Photos", value: "186" },
        { label: "Added this month", value: "5" },
        { label: "Categories", value: "6" },
      ]}
      main={
        <div className={cn(FLOAT_CARD, "min-h-0 p-2.5")}>
          <div className="grid size-full grid-cols-3 grid-rows-2 gap-2">
            {PORTFOLIO.map(([label, , src], index) => (
              <div
                key={label}
                className={cn(
                  "relative min-h-0 overflow-hidden rounded-xl transition-[transform,box-shadow,opacity] duration-700",
                  EASE,
                  index === step
                    ? "z-10 scale-[1.04] opacity-100 shadow-lg ring-2 ring-primary"
                    : "opacity-70",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- small sample photo inside the mock */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      }
      side={
        <>
          <Panel title="Selected project" fill>
            <div
              key={step}
              className="animate-in fade-in slide-in-from-bottom-1 flex flex-1 flex-col justify-center gap-1 p-3 duration-500"
            >
              <p className="text-sm font-semibold tracking-tight">{title}</p>
              <p className="text-[11px] text-muted-foreground">{meta}</p>
              <p className="mt-2 text-[11px]">
                <span className="text-muted-foreground">Shown on</span>{" "}
                <span className="font-medium">your public profile</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {step + 1} of {PORTFOLIO.length} featured projects
              </p>
            </div>
          </Panel>
          <Panel title="Categories" className="shrink-0">
            <div className="flex flex-wrap gap-1.5 p-3">
              {[
                "Kitchens",
                "Baths",
                "Electrical",
                "Outdoor",
                "Paint",
                "Roofing",
              ].map((label, index) => (
                <span
                  key={label}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-500",
                    index === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </Panel>
        </>
      }
    />
  );
}

/** Service areas: cities drop onto the map and their ZIP codes fill the coverage list. */
const AREAS = [
  { city: "Aurora", x: 34, y: 42, zips: ["60502", "60504", "60505"] },
  { city: "Naperville", x: 62, y: 60, zips: ["60540", "60563"] },
  { city: "Oswego", x: 28, y: 78, zips: ["60543"] },
  { city: "Batavia", x: 58, y: 24, zips: ["60510"] },
] as const;
const AREAS_MS = 1300;

function ServiceAreasVisual() {
  const { ref, step } = useLoopStep(AREAS.length + 1, AREAS_MS);
  const shown = AREAS.slice(0, Math.min(step + 1, AREAS.length));
  const zips = shown.flatMap((area) => area.zips);

  return (
    <BoardLayout
      rootRef={ref}
      stats={[
        { label: "Cities", value: <CountUp value={shown.length} /> },
        { label: "ZIP codes", value: <CountUp value={zips.length} /> },
        { label: "Requests this month", value: "37" },
        {
          label: "From new areas",
          value: <CountUp value={shown.length * 3} />,
        },
      ]}
      main={
        <div
          className={cn(
            FLOAT_CARD,
            "relative min-h-0 overflow-hidden bg-[radial-gradient(circle,rgba(0,63,125,0.08)_1px,transparent_1px)] bg-size-[14px_14px]",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 left-1/2 size-56 rounded-full border border-dashed border-primary/40 bg-primary/5 transition-transform duration-1000",
              EASE,
            )}
            style={{
              transform: `translate(-50%, -50%) scale(${0.5 + shown.length * 0.13})`,
            }}
          />
          {AREAS.map((area, index) => (
            <span
              key={area.city}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-full flex-col items-center transition-[opacity,scale] duration-500",
                EASE,
                index < shown.length
                  ? "scale-100 opacity-100"
                  : "scale-50 opacity-0",
              )}
              style={{ left: `${area.x}%`, top: `${area.y}%` }}
            >
              <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
                {area.city}
              </span>
              <MapPin
                className="size-5 fill-primary text-background"
                aria-hidden="true"
              />
            </span>
          ))}
        </div>
      }
      side={
        <>
          <Panel title="ZIP codes covered" aside={String(zips.length)} fill>
            <div className="flex flex-wrap content-start gap-1.5 p-3">
              {zips.map((zip) => (
                <span
                  key={zip}
                  className="animate-in fade-in zoom-in-90 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums duration-300"
                >
                  {zip}
                </span>
              ))}
            </div>
          </Panel>
          <Panel title="Cities" className="shrink-0">
            <ul className="flex flex-col gap-1.5 p-3 text-[11px]">
              {AREAS.map((area, index) => (
                <li
                  key={area.city}
                  className={cn(
                    "flex justify-between transition-opacity duration-500",
                    index < shown.length ? "opacity-100" : "opacity-35",
                  )}
                >
                  <span className="font-medium">{area.city}</span>
                  <span className="text-muted-foreground">
                    {area.zips.length} ZIP{area.zips.length > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      }
    />
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
  contractors: {
    Mock: ContractorsVisual,
    loopMs: CONTRACTORS_STEPS * CONTRACTORS_MS,
  },
  vendors: { Mock: VendorsVisual, loopMs: PO_STEPS * VENDORS_MS },
  tracking: { Mock: TrackingVisual, loopMs: TRACKING_STEPS * TRACKING_MS },
  reminders: { Mock: RemindersVisual, loopMs: REMINDERS_STEPS * REMINDERS_MS },
  timesheets: {
    Mock: TimesheetsVisual,
    loopMs: TIME_FRAMES.length * TIMESHEETS_MS,
  },
  leads: { Mock: LeadsVisual, loopMs: LEAD_FEED.length * LEADS_MS },
  messages: { Mock: MessagesVisual, loopMs: (CHAT.length + 1) * MESSAGES_MS },
  estimates: { Mock: EstimateVisual, loopMs: ESTIMATE_STEPS * ESTIMATE_MS },
  jobs: { Mock: JobsVisual, loopMs: JOB_STAGES.length * JOBS_MS },
  tasks: { Mock: TasksVisual, loopMs: (TASKS.length + 1) * TASKS_MS },
  schedules: {
    Mock: SchedulesVisual,
    loopMs: SCHEDULE_FRAMES.length * SCHEDULE_MS,
  },
  orders: { Mock: OrdersVisual, loopMs: ORDER_STAGES.length * ORDERS_MS },
  invoices: {
    Mock: InvoicesVisual,
    loopMs: INVOICE_FRAMES.length * INVOICES_MS,
  },
  payments: {
    Mock: PaymentsVisual,
    loopMs: PAYMENT_METHODS.length * PAYMENTS_MS,
  },
  profile: { Mock: ProfileVisual, loopMs: PROFILE_STEPS * PROFILE_MS },
  "fixed-services": {
    Mock: FixedServicesVisual,
    loopMs: SERVICES.length * FIXED_MS,
  },
  "ai-receptionist": { Mock: AiReceptionistVisual, loopMs: CALL_LOOP_MS },
  portfolio: { Mock: PortfolioVisual, loopMs: PORTFOLIO.length * PORTFOLIO_MS },
  "service-areas": {
    Mock: ServiceAreasVisual,
    loopMs: (AREAS.length + 1) * AREAS_MS,
  },
  reports: { Mock: ReportsVisual, loopMs: REPORTS_STEPS * REPORTS_MS },
};
