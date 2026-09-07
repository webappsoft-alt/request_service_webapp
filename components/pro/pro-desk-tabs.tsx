"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, MapPin, Phone, Sparkles } from "lucide-react";
import { ProLocationsMapLazy } from "@/components/pro/pro-locations-map-lazy";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

const tabs = [
  {
    id: "booking" as const,
    tab: "Online booking",
    eyebrow: "Online booking",
    title: "They pick a slot. You get the file.",
    body: "A link on your public profile. They choose a day and time inside the hours you already set. That booking is the same record you quote, schedule, and invoice.",
    points: [
      "Working hours you control — evenings and Sundays stay closed",
      "The slot, address, and notes arrive together",
      "No phone tag, no retyping into a second system",
    ],
  },
  {
    id: "jobs" as const,
    tab: "Jobs",
    eyebrow: "Jobs",
    title: "The signed estimate becomes the work.",
    body: "Once they sign, the file is a job on the board. Office and field open the same record. Scope, the assigned tech, and status stay on that card through the last invoice.",
    points: [
      "See today’s jobs, who is on them, and what is next",
      "The crew sees only the approved scope",
      "Change orders sit beside the original — they never overwrite it",
    ],
  },
  {
    id: "customers" as const,
    tab: "Customers",
    eyebrow: "Customers",
    title: "Every past job sits on the same person.",
    body: "Address, phone, and every estimate they signed live on one customer. The next quote starts from history, not a blank page.",
    points: [
      "Open the person, see every file you have sent them",
      "Notes from the last visit stay with the address",
      "Repeat work does not need the homeowner to re-explain the house",
    ],
  },
  {
    id: "team" as const,
    tab: "Team",
    eyebrow: "Team members",
    title: "Office and field on one roster.",
    body: "Who is working, what they do, and which job they are on. Assign the signed file to a technician without a text thread.",
    points: [
      "Office seats and field seats on the same list",
      "See who is free before you put a job on the day",
      "The name on the calendar is the name on the job file",
    ],
  },
  {
    id: "mobile" as const,
    tab: "Mobile app",
    eyebrow: "Mobile app",
    title: "The crew’s day, on the phone.",
    body: "Technicians open today’s schedule. Each stop is the same job file — address, approved scope, and what they need to do. They mark on the way and done from the truck.",
    points: [
      "Today’s jobs in time order, next stop on top",
      "Tap a job for the address and the signed scope",
      "On the way and complete update the desk without a call",
    ],
  },
  {
    id: "locations" as const,
    tab: "Locations",
    eyebrow: "Locations",
    title: "More than one shop, one login.",
    body: "Each yard or office keeps its own service area. Jobs still land on the same desk. You are not running two products for two shops.",
    points: [
      "ZIPs belong to a location, not a spreadsheet",
      "Requests route to the shop that covers that street",
      "Reporting can still roll up across every location",
    ],
  },
  {
    id: "invoices" as const,
    tab: "Invoices",
    eyebrow: "Invoices",
    title: "Bill the file they already signed.",
    body: "The invoice is the estimate plus approved change orders. Nothing gets quietly rewritten after they said yes.",
    points: [
      "Line items come from the signed scope",
      "Extras only appear if they approved a change order",
      "Send it from the same record the crew already used",
    ],
  },
  {
    id: "payments" as const,
    tab: "Payments",
    eyebrow: "Payments",
    title: "Deposit, progress, then the balance.",
    body: "Every payment sits on the invoice until the job is settled. You always see what is still open.",
    points: [
      "Take a deposit when they sign",
      "Progress payments stay on the same invoice",
      "The remaining balance is never a guess",
    ],
  },
  {
    id: "reporting" as const,
    tab: "Reporting",
    eyebrow: "Reporting",
    title: "The month, without a second sheet.",
    body: "Jobs closed, cash collected, and aging — the questions an owner actually asks at the end of the month.",
    points: [
      "Volume and cash on one view",
      "Open invoices and average ticket in the same place",
      "No export to a second spreadsheet to know the week",
    ],
  },
  {
    id: "ai" as const,
    tab: "AI tools",
    eyebrow: "AI tools",
    title: "It writes the first pass. You keep the send.",
    body: "Scope lines, a follow-up, or a read of the job photo — drafted from the file already on RS-2841. You edit. Nothing goes to the homeowner until you say so.",
    points: [
      "Turn the tech notes into estimate lines you can change",
      "Draft the message to Maya — you still hit send",
      "Read the photos and pin findings on the same job",
    ],
  },
] as const;

type DeskTabId = (typeof tabs)[number]["id"];

function DeskTabButton({
  tab,
  active,
  onSelect,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  onSelect: (id: DeskTabId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      className={cn(
        "rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-black/15 bg-card text-foreground hover:border-black/25",
      )}
    >
      {tab.tab}
    </button>
  );
}

export function ProDeskTabs() {
  const [active, setActive] = useState<DeskTabId>("booking");
  const [beat, setBeat] = useState(0);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  useEffect(() => {
    setBeat(0);
  }, [active]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBeat((value) => value + 1);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
        <p className="eyebrow text-primary">Also included</p>
        <h3 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
          Everything the team needs after the quote.
        </h3>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          {tabs.slice(0, -2).map((tab) => (
            <DeskTabButton key={tab.id} tab={tab} active={tab.id === active} onSelect={setActive} />
          ))}
        </div>
        <div className="flex justify-center gap-2">
          {tabs.slice(-2).map((tab) => (
            <DeskTabButton key={tab.id} tab={tab} active={tab.id === active} onSelect={setActive} />
          ))}
        </div>
      </div>

      <div className="grid w-full items-start gap-10 rounded-2xl border border-black/10 bg-[#eef3f8] px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div className="flex flex-col gap-4 lg:pt-1">
          <p className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 font-mono text-[0.7rem] tracking-[0.16em] text-primary uppercase">
            {current.eyebrow}
          </p>
          <h4 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
            {current.title}
          </h4>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">{current.body}</p>
          <ul className="flex max-w-md flex-col gap-2.5">
            {current.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm leading-6">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <Link
            href={proPaths.register}
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Join as a pro
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-black/15 bg-card shadow-[0_18px_40px_-24px_rgba(0,63,125,0.4)]">
          <DeskPreview id={active} beat={beat} onPick={setBeat} />
        </div>
      </div>
    </div>
  );
}

function DeskPreview({
  id,
  beat,
  onPick,
}: {
  id: DeskTabId;
  beat: number;
  onPick: (value: number) => void;
}) {
  switch (id) {
    case "booking":
      return <BookingPreview beat={beat} onPick={onPick} />;
    case "jobs":
      return <JobsPreview beat={beat} onPick={onPick} />;
    case "customers":
      return <CustomersPreview beat={beat} onPick={onPick} />;
    case "team":
      return <TeamPreview beat={beat} onPick={onPick} />;
    case "mobile":
      return <MobilePreview beat={beat} onPick={onPick} />;
    case "locations":
      return <LocationsPreview beat={beat} onPick={onPick} />;
    case "invoices":
      return <InvoicePreview beat={beat} onPick={onPick} />;
    case "payments":
      return <PaymentsPreview beat={beat} onPick={onPick} />;
    case "reporting":
      return <ReportingPreview beat={beat} onPick={onPick} />;
    case "ai":
      return <AiPreview beat={beat} onPick={onPick} />;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function PreviewChrome({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
          {meta}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BookingPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const days = [
    { day: "Thu", date: "14", slots: ["8:00", "9:00", "11:00"] },
    { day: "Fri", date: "15", slots: ["10:00", "1:00"] },
    { day: "Mon", date: "18", slots: ["8:00", "2:00"] },
  ];
  const picked = beat % 3;

  return (
    <PreviewChrome title="Book a time" meta="Inside your hours">
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-muted-foreground">Water heater · Aurora · 80014</p>
        <div className="grid grid-cols-3 gap-2">
          {days.map((cell, index) => (
            <button
              key={cell.day}
              type="button"
              onClick={() => onPick(index)}
              className={cn(
                "rounded-lg border px-2 py-2.5 text-left",
                index === picked ? "border-primary bg-primary/[0.05]" : "border-black/10",
              )}
            >
              <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{cell.day}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{cell.date}</p>
              <div className="mt-2 flex flex-col gap-1">
                {cell.slots.map((slot, slotIndex) => (
                  <span
                    key={slot}
                    className={cn(
                      "rounded-md px-1.5 py-1 text-center text-[10px] font-medium",
                      index === picked && slotIndex === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-[#F3F7FB] text-primary",
                    )}
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </PreviewChrome>
  );
}

function JobsPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const jobs = [
    {
      id: "RS-2841",
      job: "Deep cleaning",
      customer: "Maya Chen",
      street: "1842 Dahlia St",
      when: "Thu 9:00",
      status: "Scheduled",
      tech: "Ava Chen",
      photo: "/images/crew/ava.jpg",
      scope: "3 bed / 2 bath · oven and fridge",
    },
    {
      id: "RS-2838",
      job: "Recurring clean",
      customer: "Luis Ortega",
      street: "214 Maple, Lakewood",
      when: "Thu 12:30",
      status: "On site",
      tech: "Luis Herrera",
      photo: "/images/crew/luis.jpg",
      scope: "Weekly checklist · kitchen and baths",
    },
    {
      id: "RS-2829",
      job: "Move-out clean",
      customer: "Aisha Cole",
      street: "88 Grove, Denver",
      when: "Thu 2:30",
      status: "New",
      tech: "Marcus Reed",
      photo: "/images/crew/marcus.jpg",
      scope: "Empty apartment · keys Friday",
    },
  ];
  const active = beat % jobs.length;
  const job = jobs[active];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
        <p className="text-sm font-semibold">Jobs</p>
        <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
          3 today
        </span>
      </div>
      <ul>
        {jobs.map((item, index) => (
          <li key={item.id} className={index < jobs.length - 1 ? "border-b border-black/6" : undefined}>
            <button
              type="button"
              onClick={() => onPick(index)}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left",
                index === active ? "bg-primary/[0.06]" : "hover:bg-[#F3F7FB]",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                  <Image src={item.photo} alt={item.tech} fill sizes="36px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">{item.job}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{item.id}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.customer} · {item.street}
                  </span>
                </span>
              </span>
              <span className="text-right">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                    item.status === "On site" && "bg-[#FFF4E8] text-[#C9782A]",
                    item.status === "Scheduled" && "bg-primary/8 text-primary",
                    item.status === "New" && "bg-[#F3F7FB] text-muted-foreground",
                  )}
                >
                  {item.status}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">{item.when}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-black/8 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold">{job.tech}</p>
          <p className="truncate text-[11px] text-muted-foreground">{job.scope}</p>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-primary">{job.status}</span>
      </div>
    </div>
  );
}

function CustomersPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const people = [
    {
      name: "Maya Chen",
      city: "Aurora",
      last: "Water heater",
      status: "Signed",
      jobs: 3,
      spent: "$4,210",
      photo: "/images/customers/maya.jpg",
    },
    {
      name: "Luis Ortega",
      city: "Lakewood",
      last: "Drain line",
      status: "Quoted",
      jobs: 1,
      spent: "$189",
      photo: "/images/customers/luis.jpg",
    },
    {
      name: "Aisha Cole",
      city: "Denver",
      last: "Bath fan",
      status: "Scheduled",
      jobs: 2,
      spent: "$640",
      photo: "/images/customers/priya.jpg",
    },
  ];
  const active = beat % people.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
        <p className="text-sm font-semibold">Customers</p>
        <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
          3 on file
        </span>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-black/8 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="hidden px-2 py-2 font-medium sm:table-cell">Last job</th>
            <th className="px-2 py-2 text-right font-medium">Jobs</th>
            <th className="px-4 py-2 text-right font-medium">Spent</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person, index) => (
            <tr key={person.name}>
              <td colSpan={4} className="p-0">
                <button
                  type="button"
                  onClick={() => onPick(index)}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-4 py-2.5 text-left sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]",
                    index === active ? "bg-primary/[0.06]" : "hover:bg-[#F3F7FB]",
                    index < people.length - 1 && "border-b border-black/6",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                      <Image src={person.photo} alt={person.name} fill sizes="36px" className="object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{person.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{person.city}</span>
                    </span>
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-[12px] font-medium">{person.last}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        index === active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {person.status}
                    </span>
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-muted-foreground">{person.jobs}</span>
                  <span className="text-right text-[12px] font-semibold tabular-nums">{person.spent}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const crew = [
    { name: "Luis Herrera", role: "Technician", photo: "/images/crew/luis.jpg", day: "Drain · Lakewood" },
    { name: "Ava Chen", role: "Technician", photo: "/images/crew/ava.jpg", day: "Heater · Aurora" },
    { name: "Marcus Reed", role: "Technician", photo: "/images/crew/marcus.jpg", day: "Free after 1:00" },
    { name: "Sofia Nguyen", role: "Estimator", photo: "/images/crew/sofia.jpg", day: "Site measure · Chen" },
  ];
  const active = beat % crew.length;

  return (
    <PreviewChrome title="Roster" meta="Thu, Aug 14">
      <div className="grid grid-cols-2 gap-2">
        {crew.map((person, index) => (
          <button
            key={person.name}
            type="button"
            onClick={() => onPick(index)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left",
              index === active ? "border-primary bg-primary/[0.04]" : "border-black/8",
            )}
          >
            <span className="relative size-9 overflow-hidden rounded-full ring-1 ring-black/10">
              <Image src={person.photo} alt={person.name} fill sizes="36px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold">{person.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{person.role}</p>
              <p className="truncate text-[10px] text-primary">{person.day}</p>
            </div>
          </button>
        ))}
      </div>
    </PreviewChrome>
  );
}

function MobilePreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const screens = [
    { id: "schedule" as const, label: "Schedule" },
    { id: "job" as const, label: "Job" },
  ];
  const active = beat % screens.length;

  return (
    <div className="flex justify-center bg-[#F3F7FB] px-4 py-6">
      <div className="relative w-[248px]">
        <div className="rounded-[2.35rem] bg-[#0B1220] p-[8px] shadow-[0_24px_48px_-20px_rgba(11,18,32,0.55)]">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-[#F7F9FC]">
            <div className="absolute top-2 left-1/2 z-20 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-[#0B1220]" />
            <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-[#12243C]">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <span className="flex h-2 items-end gap-px" aria-hidden="true">
                  <span className="h-1 w-0.5 rounded-sm bg-[#12243C]" />
                  <span className="h-1.5 w-0.5 rounded-sm bg-[#12243C]" />
                  <span className="h-2 w-0.5 rounded-sm bg-[#12243C]" />
                </span>
                <span className="h-2 w-3.5 rounded-[2px] border border-[#12243C]" />
              </span>
            </div>
            <div className="min-h-[392px] px-3 pt-2 pb-9">
              <MobileAppScreen id={screens[active].id} onOpenJob={() => onPick(1)} />
            </div>
            <div className="absolute inset-x-0 bottom-0 border-t border-black/6 bg-white/95">
              <div className="grid grid-cols-2 px-2 pt-1.5 pb-3">
                {screens.map((screen, index) => (
                  <button
                    key={screen.id}
                    type="button"
                    onClick={() => onPick(index)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-1 text-[10px] font-medium",
                      index === active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {screen.label}
                  </button>
                ))}
              </div>
              <div className="mx-auto mb-1.5 h-1 w-24 rounded-full bg-[#0B1220]/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileAppScreen({
  id,
  onOpenJob,
}: {
  id: "schedule" | "job";
  onOpenJob: () => void;
}) {
  switch (id) {
    case "schedule":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Thursday, Aug 14</p>
              <p className="text-[16px] font-semibold tracking-tight">Ava’s schedule</p>
            </div>
            <span className="relative size-8 overflow-hidden rounded-full ring-1 ring-black/10">
              <Image src="/images/crew/ava.jpg" alt="Ava Chen" fill sizes="32px" className="object-cover" />
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">3 jobs · next stop 9:00</p>
          <ul className="relative flex flex-col">
            <span className="absolute top-2 bottom-2 left-[17px] w-px bg-black/8" aria-hidden="true" />
            {[
              {
                time: "9:00",
                end: "11:30",
                job: "Deep cleaning",
                who: "Maya Chen",
                street: "1842 Dahlia St",
                next: true,
              },
              {
                time: "12:30",
                end: "2:00",
                job: "Recurring clean",
                who: "Luis Ortega",
                street: "214 Maple, Lakewood",
                next: false,
              },
              {
                time: "2:30",
                end: "4:00",
                job: "Move-out clean",
                who: "Priya Shah",
                street: "88 Grove, Denver",
                next: false,
              },
            ].map((stop) => (
              <li key={stop.time}>
                <button
                  type="button"
                  onClick={stop.next ? onOpenJob : undefined}
                  className="relative flex w-full gap-2.5 py-1.5 text-left"
                >
                  <span className="relative z-10 flex w-9 shrink-0 flex-col items-center">
                    <span
                      className={cn(
                        "size-2.5 rounded-full ring-2 ring-[#F7F9FC]",
                        stop.next ? "bg-primary" : "bg-[#9BB4CC]",
                      )}
                    />
                    <span className="mt-1 text-[9px] font-semibold tabular-nums text-muted-foreground">
                      {stop.time}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 rounded-xl px-2.5 py-2",
                      stop.next ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-black/6",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold">{stop.job}</span>
                      {stop.next ? (
                        <span className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide uppercase">
                          Next
                        </span>
                      ) : null}
                    </span>
                    <span className={cn("mt-0.5 block text-[10px]", stop.next ? "text-white/75" : "text-muted-foreground")}>
                      {stop.who}
                    </span>
                    <span className={cn("block text-[10px]", stop.next ? "text-white/65" : "text-muted-foreground")}>
                      {stop.street} · {stop.time}–{stop.end}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    case "job":
      return (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground">RS-2841 · 9:00–11:30</p>
            <p className="text-[16px] font-semibold tracking-tight">Deep cleaning</p>
            <p className="text-[12px] text-muted-foreground">Maya Chen</p>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            1842 Dahlia St, Aurora · 80014
          </p>
          <div className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/6">
            <p className="text-[10px] font-semibold text-primary">Work to do</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {["Kitchen and baths", "Floors and high-touch", "Oven and fridge"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[11px]">
                  <span className="size-3.5 rounded border border-primary/35" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-[11px] font-medium text-primary-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              On my way
            </span>
            <span className="flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-[11px] font-medium ring-1 ring-black/8">
              <Phone className="size-3" aria-hidden="true" />
              Call
            </span>
          </div>
        </div>
      );
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function LocationsPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const shops = [
    { name: "Aurora shop", area: "80014", jobs: "5 jobs this week" },
    { name: "Lakewood yard", area: "80226", jobs: "2 jobs this week" },
    { name: "Denver office", area: "80205", jobs: "3 jobs this week" },
  ];
  const active = beat % shops.length;
  const shop = shops[active];

  return (
    <div>
      <ProLocationsMapLazy active={active} onPick={onPick} />
      <div className="flex items-center justify-between gap-3 border-t border-black/8 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{shop.name}</p>
          <p className="text-[11px] text-muted-foreground">Covers {shop.area}</p>
        </div>
        <span className="text-[11px] font-medium text-primary">{shop.jobs}</span>
      </div>
    </div>
  );
}

function InvoicePreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const lines = [
    { item: "50-gal water heater replacement", source: "Signed estimate", qty: "1", amount: "$1,240.00" },
    { item: "Expansion tank", source: "Signed estimate", qty: "1", amount: "$420.00" },
    { item: "Copper supply line", source: "Change order", qty: "1", amount: "$75.00" },
  ];
  const sent = beat % 2 === 0;

  return (
    <button type="button" onClick={() => onPick(beat + 1)} className="w-full text-left">
      <div className="flex items-center justify-between border-b border-black/8 px-4 py-2.5">
        <p className="text-[11px] text-muted-foreground">INV-1042.pdf</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            sent ? "bg-[#E8F4EE] text-[#2F8F5B]" : "bg-primary/8 text-primary",
          )}
        >
          {sent ? "Sent Aug 21, 4:12 PM" : "Draft"}
        </span>
      </div>
      <div className="bg-[#FBFCFD] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground">
              SH
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Summit Home Systems</p>
              <p className="text-[11px] leading-5 text-muted-foreground">
                1840 Havana St · Aurora, CO 80010
                <br />
                (303) 555-0182 · Licensed · Insured
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">Invoice</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">INV-1042</p>
          </div>
        </div>

        <div className="mt-4 h-px bg-primary/20" />

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Bill to</p>
            <p className="mt-1 text-[13px] font-semibold">Maya Chen</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              1842 Dahlia St
              <br />
              Aurora, CO 80014
            </p>
          </div>
          <div className="text-right text-[11px] leading-6">
            <p>
              <span className="text-muted-foreground">Issued</span>{" "}
              <span className="font-medium">Aug 21, 2026</span>
            </p>
            <p>
              <span className="text-muted-foreground">Due</span>{" "}
              <span className="font-medium">Aug 28, 2026</span>
            </p>
            <p>
              <span className="text-muted-foreground">Job</span>{" "}
              <span className="font-medium">RS-2841</span>
            </p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-black/8 bg-[#F3F7FB] text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              <th className="px-2 py-1.5 text-left font-medium">Description</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.item} className="border-b border-black/6">
                <td className="px-2 py-2">
                  <p className="font-medium">{line.item}</p>
                  <p className="text-[10px] text-muted-foreground">{line.source}</p>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{line.qty}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">{line.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 ml-auto w-[11.5rem] text-[12px]">
          <div className="flex justify-between py-0.5 text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">$1,735.00</span>
          </div>
          <div className="flex justify-between py-0.5 text-muted-foreground">
            <span>Tax</span>
            <span className="tabular-nums">$61.95</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-primary/20 pt-1.5 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">$1,796.95</span>
          </div>
        </div>

        <div className="mt-4 border-t border-dashed border-black/12 pt-3">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Authorized
          </p>
          {sent ? (
            <div className="mt-1">
              <svg
                viewBox="0 0 200 36"
                className="h-8 w-40 text-primary"
                role="img"
                aria-label="Maya Chen signature"
              >
                <path
                  d="M6 28c10-12 16-18 20-16 5 3-6 18-1 20 5 2 14-20 21-20 6 0 1 14 6 15 6 1 12-12 18-12 5 0 2 9 8 9 7 0 12-11 20-11 6 0 4 7 10 7 7 0 14-7 22-7 9 0 15 5 21 5 6 0 12-3 18-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Check className="size-3 text-[#2F8F5B]" aria-hidden="true" />
                Maya Chen · Aug 21, 2026, 4:12 PM
              </p>
            </div>
          ) : (
            <div className="mt-2 border-b border-black/25 pb-6">
              <p className="text-[11px] text-muted-foreground">Customer signature</p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function PaymentsPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const rows = [
    { label: "Deposit", note: "Paid Aug 12", amount: "$500.00", done: true },
    { label: "Progress", note: "Paid Aug 21", amount: "$800.00", done: beat % 3 > 0 },
    { label: "Balance", note: "Due on completion", amount: "$496.95", done: beat % 3 > 1 },
  ];

  return (
    <PreviewChrome title="Payments on INV-1042" meta="$1,796.95">
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.label}>
            <button
              type="button"
              onClick={() => onPick(index)}
              className="flex w-full items-center justify-between rounded-lg bg-[#F3F7FB] px-3 py-2.5 text-left"
            >
              <span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={cn("size-2 rounded-full", row.done ? "bg-[#2F8F5B]" : "bg-[#C9782A]")}
                  />
                  {row.label}
                </span>
                <span className="mt-0.5 block pl-4 text-[11px] text-muted-foreground">{row.note}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{row.amount}</span>
            </button>
          </li>
        ))}
      </ul>
    </PreviewChrome>
  );
}

function ReportingPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const months = [
    { label: "Mar", cash: 12400, jobs: 8 },
    { label: "Apr", cash: 14100, jobs: 9 },
    { label: "May", cash: 13200, jobs: 8 },
    { label: "Jun", cash: 16800, jobs: 11 },
    { label: "Jul", cash: 15400, jobs: 10 },
    { label: "Aug", cash: 18420, jobs: 12 },
  ];
  const mix = [
    { label: "Collected", value: 72, amount: "$18,420", color: "#003F7D" },
    { label: "Open", value: 18, amount: "$4,610", color: "#0F766E" },
    { label: "Overdue", value: 10, amount: "$2,180", color: "#C9782A" },
  ];
  const shops = [
    { label: "Aurora", value: 9240 },
    { label: "Denver", value: 5880 },
    { label: "Lakewood", value: 3300 },
  ];
  const active = beat % months.length;
  const month = months[active];
  const width = 320;
  const height = 92;
  const padX = 10;
  const padY = 10;
  const maxCash = Math.max(...months.map((item) => item.cash));
  const points = months.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / (months.length - 1);
    const y = height - padY - (item.cash / maxCash) * (height - padY * 2);
    return { ...item, x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const ring = 2 * Math.PI * 28;
  const slices = mix.map((slice, index) => {
    const length = (slice.value / 100) * ring;
    const offset = mix.slice(0, index).reduce((sum, item) => sum + (item.value / 100) * ring, 0);
    return { ...slice, length, offset };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
        <p className="text-sm font-semibold">Reports</p>
        <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
          Mar–Aug 2026
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Cash collected", value: `$${month.cash.toLocaleString()}` },
            { label: "Jobs closed", value: String(month.jobs) },
            { label: "Avg. ticket", value: `$${Math.round(month.cash / month.jobs).toLocaleString()}` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-[#F3F7FB] px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-semibold">Revenue</p>
            <p className="text-[10px] text-muted-foreground">
              {month.label} · ${month.cash.toLocaleString()}
            </p>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" aria-hidden="true">
            {[0.25, 0.5, 0.75].map((lineY) => (
              <line
                key={lineY}
                x1={padX}
                x2={width - padX}
                y1={padY + (height - padY * 2) * lineY}
                y2={padY + (height - padY * 2) * lineY}
                stroke="#003F7D"
                strokeOpacity="0.08"
              />
            ))}
            <path d={area} fill="#003F7D" fillOpacity="0.1" />
            <path d={line} fill="none" stroke="#003F7D" strokeWidth="2.25" strokeLinejoin="round" />
            {points.map((point, index) => (
              <g key={point.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={index === active ? 4.5 : 3}
                  fill={index === active ? "#003F7D" : "#fff"}
                  stroke="#003F7D"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
          <div className="mt-1 grid grid-cols-6">
            {months.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onPick(index)}
                className={cn(
                  "text-center text-[10px]",
                  index === active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold">Invoice mix</p>
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 72 72" className="size-[72px] shrink-0" aria-hidden="true">
                <circle cx="36" cy="36" r="28" fill="none" stroke="#E7F0F8" strokeWidth="10" />
                {slices.map((slice) => (
                  <circle
                    key={slice.label}
                    cx="36"
                    cy="36"
                    r="28"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="10"
                    strokeDasharray={`${slice.length} ${ring - slice.length}`}
                    strokeDashoffset={-slice.offset}
                    transform="rotate(-90 36 36)"
                  />
                ))}
              </svg>
              <ul className="flex flex-col gap-1.5">
                {mix.map((slice) => (
                  <li key={slice.label} className="flex items-center gap-1.5 text-[10px]">
                    <span className="size-1.5 rounded-full" style={{ background: slice.color }} />
                    <span className="text-muted-foreground">{slice.label}</span>
                    <span className="font-semibold tabular-nums">{slice.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold">By shop</p>
            <ul className="flex flex-col gap-2">
              {shops.map((shop) => (
                <li key={shop.label}>
                  <div className="mb-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{shop.label}</span>
                    <span className="font-semibold tabular-nums">${shop.value.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#E7F0F8]">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(shop.value / shops[0].value) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiPreview({ beat, onPick }: { beat: number; onPick: (value: number) => void }) {
  const tools = [
    { id: "scope" as const, label: "Scope" },
    { id: "followup" as const, label: "Follow-up" },
    { id: "photo" as const, label: "Photo read" },
  ];
  const active = beat % tools.length;
  const tool = tools[active];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-black/8 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          AI on RS-2841
        </p>
        <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
          Needs your review
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-1.5">
          {tools.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(index)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                index === active ? "bg-primary text-primary-foreground" : "bg-[#F3F7FB] text-primary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <AiToolBody id={tool.id} />
      </div>
    </div>
  );
}

function AiToolBody({ id }: { id: "scope" | "followup" | "photo" }) {
  switch (id) {
    case "scope":
      return (
        <div className="flex flex-col gap-2.5">
          <p className="rounded-lg bg-[#F3F7FB] px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            Notes · leaking at the tank. Same-week replacement. Photos on the file.
          </p>
          <ul className="flex flex-col gap-1.5">
            {[
              { item: "50-gal water heater replacement", amount: "$1,240" },
              { item: "Expansion tank", amount: "$420" },
              { item: "Labor · 6 hours", amount: "Included" },
            ].map((row) => (
              <li
                key={row.item}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/8 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="mb-0.5 inline-block rounded bg-primary/8 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary uppercase">
                    Draft
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] font-medium">{row.item}</span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums">{row.amount}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] font-medium text-primary">Add to estimate · you still send</p>
        </div>
      );
    case "followup":
      return (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11px] text-muted-foreground">To Maya Chen · not sent</p>
          <div className="rounded-lg border border-black/8 px-3 py-3">
            <p className="text-[12px] leading-5">
              Hi Maya — we can replace the 50-gal heater this week. The draft includes the expansion
              tank from the photos. Reply here if Thursday 9:00 still works.
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Edit before it leaves the desk</p>
            <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
              Insert in thread
            </span>
          </div>
        </div>
      );
    case "photo":
      return (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2.5">
            <span className="relative h-[4.75rem] overflow-hidden rounded-lg bg-[#F3F7FB]">
              <Image
                src="/images/blog/blog-hvac.jpg"
                alt="Job photo on RS-2841"
                fill
                sizes="88px"
                className="object-cover"
              />
            </span>
            <ul className="flex flex-col justify-center gap-1.5">
              {[
                "Leak at the tank drain valve",
                "Existing unit reads ~50 gal",
                "Homeowner asked for this week",
              ].map((finding) => (
                <li key={finding} className="flex items-start gap-1.5 text-[11px] leading-4">
                  <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] font-medium text-primary">Pin findings to the job file</p>
        </div>
      );
    default: {
      const _never: never = id;
      return _never;
    }
  }
}
