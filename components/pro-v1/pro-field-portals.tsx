"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Camera,
  CircleCheck,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  FileText,
  HardHat,
  Info,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/** Seconds since a start offset, ticking only while the element is on screen (still with reduced motion). */
function useElapsed(start: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(start);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    if (!node) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting)
        timer = window.setInterval(
          () => setSeconds((value) => value + 1),
          1000,
        );
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return { ref, seconds };
}

function hms(total: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/* ─────────────────────────── Technician portal ─────────────────────────── */

/** What the technician portal really shows (/technical dashboard, schedule, time tracking, payments). */
const TECH_FEATURES = [
  {
    icon: Clock3,
    title: "Live clock-in",
    body: "Clock in on the job; the timer runs in the header until they clock out.",
  },
  {
    icon: CalendarDays,
    title: "Today's schedule",
    body: "Jobs and estimate visits for the day, with the address and time window.",
  },
  {
    icon: Briefcase,
    title: "Active job tracking",
    body: "Open the job for its scope and stages, and mark each one as it's done.",
  },
  {
    icon: Wallet,
    title: "Pay tracking",
    body: "Hours, pay rate, earned, paid, and what's still owed — no asking the office.",
  },
] as const;

const TECH_SCHEDULE = [
  {
    time: "9:00 AM",
    kind: "Job",
    title: "JOB-333 · Repair",
    who: "Huraira Customer · 9–11 AM",
    now: true,
  },
  {
    time: "1:00 PM",
    kind: "Estimate visit",
    title: "EST-412 · Water softener",
    who: "Marcus Johnson · 1–2 PM",
    now: false,
  },
  {
    time: "3:30 PM",
    kind: "Job",
    title: "JOB-338 · Install",
    who: "Grace Thompson · 3:30–5 PM",
    now: false,
  },
] as const;

/**
 * Pro landing (for-pros-v1): the technician portal — copy and features on the left, and on the
 * right the technician dashboard in a browser frame (live clock-in timer, numbers at a glance,
 * today's schedule, pay). Built from the real /technical views.
 */
export function ProTechnicianPortal() {
  const { ref, seconds } = useElapsed(8 * 60 + 42);

  return (
    <Section id="technicians" className="relative scroll-mt-24 bg-muted/50">
      <Container className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        {/* Copy */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Wrench className="size-3.5" aria-hidden="true" />
              Technician portal
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Your crew&apos;s jobs, schedule, and hours in one place.
            </h2>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
              Add a technician and give them a username and password. They sign
              in on their phone or any browser and see only the work assigned to
              them — the office sees every clock-in and finished stage as it
              happens.
            </p>
          </div>

          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {TECH_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex flex-col gap-1.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ul>

          <Link
            href={proPaths.register}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Add your crew free
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Technician dashboard, framed like the real portal captures */}
        <div ref={ref} className="min-w-0">
          <TechnicianDashboardPreview seconds={seconds} />
        </div>
      </Container>
    </Section>
  );
}

/** Real technician nav (technician-shell). */
const TECH_NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "Jobs" },
  { icon: FileText, label: "Estimates" },
  { icon: CalendarDays, label: "Schedule" },
  { icon: Clock3, label: "Time Tracking" },
  { icon: Wallet, label: "Payments" },
  { icon: MessageSquare, label: "Messages" },
  { icon: UserRound, label: "Profile" },
] as const;

/**
 * The technician dashboard (/technical) in a light browser frame, like the pro screenshots:
 * brand-blue sidebar, live JOB-333 timer, greeting, clocked-in bar, numbers at a glance, today's
 * schedule, and pay. Sample data.
 */
function TechnicianDashboardPreview({ seconds }: { seconds: number }) {
  return (
    <div
      role="img"
      data-light
      aria-label="Technician dashboard: clocked in on JOB-333 with a running timer, hours and jobs at a glance, today's schedule, and pay"
      className="overflow-hidden rounded-xl border border-black/8 bg-white text-left text-slate-900 shadow-[0_30px_70px_-30px_rgba(2,16,36,0.45),0_8px_20px_-12px_rgba(2,16,36,0.25)] ring-1 ring-black/5"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-black/6 bg-[#f4f6f9] px-3.5 py-2">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto hidden h-6 w-full max-w-sm items-center justify-center truncate rounded-md bg-white px-3 font-mono text-[10px] text-slate-500 ring-1 ring-black/6 sm:flex">
          app.requestservice.com/technical/dashboard
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-36 shrink-0 flex-col bg-[#003F7D] text-white sm:flex">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
              <Wrench className="size-3" aria-hidden="true" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] font-semibold">
                Summit Home Services
              </p>
              <p className="text-[7px] font-semibold tracking-[0.18em] text-[#9cc3ec] uppercase">
                Technician portal
              </p>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-0.5 p-1.5">
            {TECH_NAV.map((item, index) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]",
                    index === 0
                      ? "bg-white/15 font-semibold text-white"
                      : "text-white/70",
                  )}
                >
                  <Icon className="size-3 shrink-0" aria-hidden="true" />
                  {item.label}
                </li>
              );
            })}
          </ul>
          <p className="border-t border-white/10 px-3 py-2 text-[8px] text-white/60">
            Working with{" "}
            <span className="font-semibold text-white">
              Summit Home Services
            </span>
          </p>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#f5f6fa]">
          <div className="flex items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#003F7D]/20 bg-[#e8f0f9] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#003F7D] tabular-nums">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              JOB-333 {hms(seconds)}
            </span>
            <span className="flex size-6 items-center justify-center rounded-full bg-[#e8f0f9] text-[9px] font-semibold text-[#003F7D]">
              TR
            </span>
          </div>

          <div className="flex flex-col gap-2.5 p-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Technician
                </p>
                <p className="text-sm font-semibold">Good afternoon, Tate</p>
                <p className="truncate text-[10px] text-slate-500">
                  Your jobs, visits, and hours. Everything here is assigned to
                  you.
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-[#003F7D] px-2 py-1 text-[10px] font-semibold text-white">
                Open schedule
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#003F7D]/25 bg-[#e8f0f9] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[8px] font-semibold tracking-[0.16em] text-[#003F7D] uppercase">
                  Currently clocked in
                </p>
                <p className="truncate text-xs font-semibold">
                  JOB-333 · Water heater repair
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-base font-bold text-[#003F7D] tabular-nums">
                  {hms(seconds)}
                </span>
                <span className="rounded-md bg-[#003F7D] px-2 py-0.5 text-[10px] font-semibold text-white">
                  Open
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-4">
              {[
                ["Hours today", "4.3 hrs", "3 sessions"],
                ["This week", "31.5 hrs", "$693 earned"],
                ["Open jobs", "2", "1 completed"],
                ["Visits today", "3", "$22.00/hr"],
              ].map(([label, value, note], index) => (
                <div
                  key={label}
                  className={cn(
                    "px-2.5 py-2",
                    index % 2 === 1 && "border-l border-slate-200",
                    index === 2 &&
                      "border-t border-slate-200 sm:border-t-0 sm:border-l",
                    index === 3 && "border-t border-slate-200 sm:border-t-0",
                  )}
                >
                  <dt className="text-[8px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                    {label}
                  </dt>
                  <dd
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      index > 1 && "text-[#003F7D]",
                    )}
                  >
                    {value}
                  </dd>
                  <dd className="text-[9px] text-slate-500">{note}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <p className="flex items-center justify-between bg-[#003F7D] px-2.5 py-1.5 text-[11px] font-semibold text-white">
                  Today&apos;s schedule
                  <span className="rounded-full bg-white/20 px-1.5 text-[9px]">
                    3 today
                  </span>
                </p>
                <ul className="flex flex-col gap-1 p-1.5">
                  {TECH_SCHEDULE.map((item) => (
                    <li
                      key={item.title}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1",
                        item.now
                          ? "border border-[#003F7D]/25 bg-[#e8f0f9]"
                          : "bg-slate-50",
                      )}
                    >
                      <span className="w-12 shrink-0 text-[9px] font-semibold text-[#003F7D] tabular-nums">
                        {item.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate text-[10px] font-semibold">
                          {item.title}
                          {item.now ? (
                            <span className="rounded-full bg-[#003F7D] px-1 text-[7px] font-bold text-white">
                              NOW
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-[9px] text-slate-500">
                          {item.who}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <p className="text-[11px] font-semibold">Clock in &amp; pay</p>
                <dl className="mt-1.5 grid grid-cols-3 gap-1 sm:grid-cols-1">
                  {[
                    ["Earned", "$412.50"],
                    ["Paid", "$300.00"],
                    ["Remaining", "$112.50"],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className={cn(
                        "rounded-md px-2 py-1",
                        index === 0 ? "bg-[#e8f0f9]" : "bg-slate-50",
                      )}
                    >
                      <dt className="text-[8px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                        {label}
                      </dt>
                      <dd className="text-xs font-semibold tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Contractor portal ─────────────────────────── */

/** The real contractor portal nav (contractor-shell). */
const CONTRACTOR_NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Briefcase, label: "Assigned Jobs" },
  { icon: CalendarDays, label: "Schedule" },
  { icon: MessageSquare, label: "Messages" },
  { icon: FilePlus2, label: "Change Requests" },
  { icon: Wallet, label: "Invoices / Payouts" },
  { icon: UserRound, label: "Profile" },
] as const;

/** Same four cards as the real contractor dashboard, with sample numbers. */
const CONTRACTOR_STATS = [
  {
    icon: Briefcase,
    value: "3",
    label: "Total assigned jobs",
    note: "2 active",
    tone: "bg-[#e8f0f9] text-[#003F7D]",
  },
  {
    icon: CircleCheck,
    value: "12",
    label: "Completed jobs",
    note: "",
    tone: "bg-[#e8f0f9] text-[#003F7D]",
  },
  {
    icon: CircleDollarSign,
    value: "$14,820",
    label: "Total earned",
    note: "$13,540 received · $1,280 due",
    tone: "bg-[#e8f0f9] text-[#003F7D]",
  },
  {
    icon: Clock3,
    value: "1",
    label: "Pending reviews",
    note: "1 in progress",
    tone: "bg-amber-50 text-amber-600",
  },
] as const;

const CONTRACTOR_FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Assigned jobs",
    body: "Every job with the labor, material, and equipment it needs — and the agreed fixed or hourly pay.",
  },
  {
    icon: Camera,
    title: "Photo proof",
    body: "They close out work with photos. The office approves or sends notes back.",
  },
  {
    icon: FilePlus2,
    title: "Change orders",
    body: "Extra material or work is requested right from the job, priced before it starts.",
  },
  {
    icon: Wallet,
    title: "Invoices & payouts",
    body: "Their invoices and your payments in one tab, with insurance and license on file.",
  },
] as const;

/**
 * Pro landing (for-pros-v1): the contractor (subcontractor) portal — the preview of the real
 * contractor dashboard (in the pro brand blue) on the left with its sign-in card overlapping,
 * and the copy in the site's brand colours on the right.
 */
export function ProContractorPortal() {
  return (
    <Section id="contractors" className="relative scroll-mt-24 bg-background">
      <Container className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
        {/* Portal preview — left on desktop, first on smaller screens */}
        <div className="relative min-w-0 sm:pr-10 sm:pb-24">
          <ContractorDashboardPreview />
          <ContractorLoginCard />
        </div>

        {/* Copy */}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <HardHat className="size-3.5" aria-hidden="true" />
              Contractor portal
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Your subs get a portal of their own.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Invite a subcontractor and assign the job. They sign in to see the
              work you gave them — jobs, proof of work, and change orders in one
              place — and nothing else in your business. No group chats.
            </p>
          </div>

          <ul className="flex flex-col">
            {CONTRACTOR_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="flex gap-4 border-t border-border py-3 first:border-t-0 first:pt-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[15px] font-semibold">{item.title}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <Button size="lg" className="w-fit" asChild>
            <Link href={proPaths.register}>
              Invite your subs
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}

/** The contractor dashboard, laid out like /contractor/dashboard. */
function ContractorDashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Contractor portal dashboard: assigned, completed, earned and pending-review cards, the next jobs, and recent office feedback"
      data-light
      className="flex overflow-hidden rounded-[1.25rem] border border-border bg-[#f3f5f8] text-left text-slate-900 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)]"
    >
      {/* Sidebar */}
      <aside className="hidden w-40 shrink-0 flex-col bg-[#003F7D] text-white sm:flex">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
            <HardHat className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-semibold">
              Summit Home Services
            </p>
            <p className="text-[7px] font-semibold tracking-[0.18em] text-[#9cc3ec] uppercase">
              Contractor portal
            </p>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 p-1.5">
          {CONTRACTOR_NAV.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px]",
                  index === 0
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/70",
                )}
              >
                <Icon
                  className={cn(
                    "size-3 shrink-0",
                    index === 0 && "text-[#9cc3ec]",
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </li>
            );
          })}
        </ul>
        <p className="border-t border-white/10 px-3 py-2 text-[8px] text-white/60">
          Working with{" "}
          <span className="font-semibold text-white">Summit Home Services</span>
        </p>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
          <p className="text-[8px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            Contractor / Dashboard
          </p>
          <p className="text-sm font-semibold">
            Welcome, Front Range Landscaping
          </p>
          <p className="text-[10px] text-slate-500">
            Work assigned to you by Summit Home Services.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-2">
          {CONTRACTOR_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <li
                key={stat.label}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    stat.tone,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-semibold tabular-nums">
                    {stat.value}
                  </p>
                  <p className="truncate text-[9px] text-slate-600">
                    {stat.label}
                  </p>
                  {stat.note ? (
                    <p className="truncate text-[8px] text-[#003F7D]">
                      {stat.note}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] font-semibold">
              Up next
              <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#003F7D]">
                All jobs <ArrowRight className="size-2.5" aria-hidden="true" />
              </span>
            </p>
            <ul className="flex flex-col gap-1 p-1.5">
              {[
                {
                  id: "JOB-842",
                  title: "Backyard regrade & drainage",
                  meta: "Oct 12 · Fixed $1,850",
                  status: "Active",
                },
                {
                  id: "JOB-851",
                  title: "Retaining wall, 40 ft",
                  meta: "Oct 16 · Hourly $48/hr",
                  status: "Scheduled",
                },
              ].map((job) => (
                <li
                  key={job.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold">
                      <span className="text-[#003F7D]">{job.id}</span> ·{" "}
                      {job.title}
                    </p>
                    <p className="truncate text-[9px] text-slate-500">
                      {job.meta}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e8f0f9] px-1.5 py-px text-[8px] font-semibold text-[#003F7D]">
                    {job.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold">
              Recent office feedback
            </p>
            <ul className="flex flex-col gap-1 p-1.5">
              <li className="rounded-lg bg-[#e8f0f9] px-2 py-1.5">
                <p className="text-[10px] font-semibold text-[#003F7D]">
                  JOB-788 · Proof approved
                </p>
                <p className="truncate text-[9px] text-slate-600">
                  Invoice INV-C-204 paid
                </p>
              </li>
              <li className="rounded-lg bg-amber-50 px-2 py-1.5">
                <p className="text-[10px] font-semibold text-amber-700">
                  Change request · +$420
                </p>
                <p className="truncate text-[9px] text-slate-600">
                  Extra drainage trench · in review
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The contractor sign-in card (like /contractor/login), overlapping the dashboard (sm and up). */
function ContractorLoginCard() {
  return (
    <div
      aria-hidden="true"
      data-light
      className="absolute right-0 bottom-0 hidden w-60 rotate-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.35)] sm:block"
    >
      <p className="text-[8px] font-semibold tracking-[0.18em] text-[#003F7D] uppercase">
        Contractor sign in
      </p>
      <p className="mt-0.5 text-sm font-semibold">Welcome back</p>
      <div className="mt-3 flex flex-col gap-2 text-[10px]">
        <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-slate-600">
          <Mail className="size-3 text-slate-400" /> erin@frontrange.co
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-[#003F7D]/40 bg-slate-50/60 px-2.5 py-1.5 text-slate-600 ring-2 ring-[#003F7D]/15">
          <Lock className="size-3 text-slate-400" /> ••••••••
        </span>
        <span className="flex items-center justify-center gap-1 rounded-lg bg-[#003F7D] py-1.5 font-semibold text-white">
          Sign in <ArrowRight className="size-3" />
        </span>
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[#e8f0f9] px-2 py-1.5 text-[8px] leading-snug text-slate-600">
        <Info className="mt-px size-2.5 shrink-0 text-[#003F7D]" />
        Access is set up by the company that hired you.
      </p>
    </div>
  );
}
