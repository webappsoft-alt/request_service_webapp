import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProDeskTabs } from "@/components/pro/pro-desk-tabs";
import { ProJobFile } from "@/components/pro/pro-job-file";
import { cn } from "@/lib/utils";

const featured = [
  {
    id: "requests" as const,
    number: "01",
    label: "Job requests",
    title: "Every job lands in one inbox.",
    body: "Marketplace requests matched to your trade and ZIP, plus the homeowners who booked your company by name.",
    points: ["Photos, notes, and address attached", "Reply with an estimate in a click"],
  },
  {
    id: "estimates" as const,
    number: "02",
    label: "Estimates",
    title: "Send a scope they can sign.",
    body: "Labor, materials, tax, and terms on one page. When extras come up, they go on a change order.",
    points: ["Digital approval and signature", "The original estimate is never overwritten"],
  },
  {
    id: "schedule" as const,
    number: "03",
    label: "Schedule",
    title: "Fill every tech's day in minutes.",
    body: "A day timeline for the crew. Drop the signed job on a technician, see the hours, and move a block without losing the scope.",
    points: ["Technicians on the left, hours across the top", "Color-coded jobs with the customer and address"],
  },
] as const;

type FeaturedId = (typeof featured)[number]["id"];

export function ProWorkflow() {
  return (
    <Section id="how-it-works" density="tight" className="scroll-mt-24">
      <Container className="flex flex-col gap-10 lg:gap-12">
        <div className="flex max-w-xl flex-col gap-3">
          <p className="eyebrow text-primary">The portal</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">
            The office, in one login.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            The full field-service desk — requests through payment — on the same job file. No
            commission on the work you win.
          </p>
        </div>

        <div className="relative">
          <span
            className="pointer-events-none absolute inset-x-4 -top-8 -bottom-6 hidden rounded-[2rem] bg-primary/[0.06] lg:block"
            aria-hidden="true"
          />
          <ProJobFile />
        </div>

        <div className="flex flex-col gap-16 lg:gap-20">
          {featured.map((item, index) => (
            <article
              key={item.id}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
            >
              <div className={cn("flex flex-col gap-4", index % 2 === 1 && "lg:order-2")}>
                <p className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 font-mono text-[0.7rem] tracking-[0.16em] text-primary uppercase">
                  {item.number} · {item.label}
                </p>
                <h3 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
                  {item.title}
                </h3>
                <p className="max-w-md text-sm leading-7 text-muted-foreground">{item.body}</p>
                <ul className="flex flex-col gap-2">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn(index % 2 === 1 && "lg:order-1")}>
                <FeaturePanel id={item.id} />
              </div>
            </article>
          ))}
        </div>

        <div id="product" className="scroll-mt-24">
          <ProDeskTabs />
        </div>
      </Container>
    </Section>
  );
}

function FeaturePanel({ id }: { id: FeaturedId }) {
  switch (id) {
    case "requests":
      return <RequestsPanel />;
    case "estimates":
      return <EstimatePanel />;
    case "schedule":
      return <SchedulePanel />;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function RequestsPanel() {
  const rows = [
    {
      name: "Maya Chen",
      job: "Deep cleaning",
      place: "Aurora · 80014",
      age: "22m",
      status: "New",
      tone: "navy" as const,
      note: "3 bed, 2 bath. Kitchen and baths are overdue. Same-week deep clean if you can.",
      image: "/images/services/service-cleaning.jpg",
      open: true,
    },
    {
      name: "Luis Ortega",
      job: "Recurring clean",
      place: "Lakewood · 80226",
      age: "1h",
      status: "New",
      tone: "teal" as const,
      note: "Weekly house cleaning, published checklist.",
      image: "/images/services/service-bathroom.jpg",
      open: false,
    },
    {
      name: "Priya Shah",
      job: "Move-out clean",
      place: "Denver · 80211",
      age: "3h",
      status: "Quoted",
      tone: "amber" as const,
      note: "Empty apartment. Need it ready for keys Friday.",
      image: "/images/services/service-handyman.jpg",
      open: false,
    },
  ];
  const open = rows[0];

  return (
    <div className="rounded-2xl bg-primary/[0.06] p-2.5 sm:p-3">
      <div className="overflow-hidden rounded-xl border border-black/15 bg-card shadow-[0_18px_40px_-24px_rgba(0,63,125,0.4)]">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Inbox</p>
            <p className="text-[11px] text-muted-foreground">3 waiting · this week</p>
          </div>
          <div className="flex items-center gap-1">
            {["New", "Quoted", "All"].map((filter, index) => (
              <span
                key={filter}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium",
                  index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {filter}
              </span>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ul className="border-black/8 sm:border-r">
            {rows.map((row) => (
              <li
                key={row.name}
                className={cn(
                  "flex items-start gap-2.5 border-b border-black/8 px-3 py-2.5 last:border-b-0",
                  row.open && "bg-primary/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 size-2 shrink-0 rounded-full",
                    row.tone === "navy" && "bg-[#003F7D]",
                    row.tone === "teal" && "bg-[#0F766E]",
                    row.tone === "amber" && "bg-[#C9782A]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-semibold">{row.name}</p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {row.age}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.job} · {row.place}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 p-3">
            <div className="relative h-28 overflow-hidden rounded-lg">
              <Image
                src={open.image}
                alt={`${open.job} request from ${open.name}`}
                fill
                sizes="(min-width: 1024px) 22vw, 80vw"
                className="object-cover"
              />
              <span className="absolute top-2 right-2 rounded-full bg-[#003F7D] px-2 py-0.5 text-[10px] font-medium text-white">
                {open.status}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold">{open.job}</p>
              <p className="text-[11px] text-muted-foreground">
                {open.name} · {open.place}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-foreground/80">{open.note}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
                Reply with estimate
              </span>
              <span className="rounded-md border border-black/10 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                Later
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EstimatePanel() {
  const lines = [
    { tone: "navy" as const, kind: "Labor", label: "Deep clean · 3 bed / 2 bath", detail: "4 hrs", amount: "$289" },
    { tone: "teal" as const, kind: "Add-on", label: "Oven and fridge", detail: "Inside appliances", amount: "$45" },
    { tone: "amber" as const, kind: "Tax", label: "Sales tax", detail: "8.25%", amount: "$27.56" },
  ];

  return (
    <div className="rounded-2xl bg-primary/[0.06] p-2.5 sm:p-3">
      <div className="overflow-hidden rounded-xl border border-black/15 bg-card shadow-[0_18px_40px_-24px_rgba(0,63,125,0.4)]">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
              EST-2841
            </span>
            <p className="text-sm font-semibold">Deep cleaning</p>
          </div>
          <div className="flex items-center gap-1">
            {["Scope", "Sign"].map((tab, index) => (
              <span
                key={tab}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium",
                  index === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {tab}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="border-black/8 px-3 py-3 sm:border-r">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold">Maya Chen</p>
                <p className="text-[10px] text-muted-foreground">1842 Dahlia St · Aurora</p>
              </div>
              <span className="rounded-full bg-[#E8F4EE] px-2 py-0.5 text-[10px] font-medium text-[#2F8F5B]">
                Signed
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {lines.map((line) => (
                <li
                  key={line.label}
                  className="flex items-center gap-2 rounded-lg bg-[#F4F7FA] px-2.5 py-2"
                >
                  <span
                    className={cn(
                      "w-10 shrink-0 rounded px-1 py-1 text-center text-[8px] font-semibold tracking-wide text-white uppercase",
                      line.tone === "navy" && "bg-[#003F7D]",
                      line.tone === "teal" && "bg-[#0F766E]",
                      line.tone === "amber" && "bg-[#C9782A]",
                    )}
                  >
                    {line.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{line.label}</p>
                    <p className="text-[10px] text-muted-foreground">{line.detail}</p>
                  </div>
                  <p className="text-[12px] font-semibold tabular-nums">{line.amount}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 p-3">
            <div className="relative h-24 overflow-hidden rounded-lg">
              <Image
                src="/images/services/service-cleaning-work.jpg"
                alt="Crew cleaning windows on the Chen deep-clean job"
                fill
                sizes="(min-width: 1024px) 18vw, 70vw"
                className="object-cover"
              />
            </div>
            <div className="rounded-lg bg-[#F4F7FA] px-3 py-2.5">
              <svg
                viewBox="0 0 200 36"
                className="h-7 w-full text-primary"
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
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Check className="size-3 text-[#2F8F5B]" aria-hidden="true" />
                Maya Chen · Aug 14, 2:41 PM
              </p>
            </div>
            <div className="rounded-lg bg-primary px-3 py-2.5 text-primary-foreground">
              <p className="text-[10px] tracking-wide text-white/70 uppercase">Total</p>
              <p className="text-xl font-semibold tabular-nums">$361.56</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ScheduleTone = "navy" | "teal" | "amber" | "rose" | "slate";

const scheduleToneClass: Record<ScheduleTone, string> = {
  navy: "bg-[#003F7D] text-white shadow-[0_8px_18px_-10px_rgba(0,63,125,0.7)]",
  teal: "bg-[#0F766E] text-white shadow-[0_8px_18px_-10px_rgba(15,118,110,0.55)]",
  amber: "bg-[#C9782A] text-white shadow-[0_8px_18px_-10px_rgba(201,120,42,0.55)]",
  rose: "bg-[#B44A6A] text-white shadow-[0_8px_18px_-10px_rgba(180,74,106,0.5)]",
  slate: "border border-dashed border-black/20 bg-[#EEF2F6] text-muted-foreground",
};

function formatHour(hour: number) {
  if (hour === 12) return "12PM";
  if (hour > 12) return `${hour - 12}PM`;
  return `${hour}AM`;
}

function SchedulePanel() {
  const startHour = 8;
  const hours = [8, 9, 10, 11, 12, 13, 14];
  const views = ["Today", "Week", "Month", "Timeline"] as const;
  const techs = [
    {
      id: "unassigned",
      photo: "",
      name: "Unassigned",
      role: "",
      jobs: [
        {
          start: 8,
          span: 1.4,
          number: "2844",
          customer: "Hold for crew",
          street: "Needs a technician",
          tone: "slate" as const,
        },
      ],
    },
    {
      id: "luis",
      photo: "/images/crew/luis.jpg",
      name: "Luis Herrera",
      role: "Technician",
      jobs: [
        {
          start: 8,
          span: 2.4,
          number: "379",
          customer: "Luis Ortega",
          street: "214 Maple, Lakewood",
          tone: "teal" as const,
        },
      ],
    },
    {
      id: "ava",
      photo: "/images/crew/ava.jpg",
      name: "Ava Chen",
      role: "Technician",
      jobs: [
        {
          start: 9.2,
          span: 2.8,
          number: "2841",
          customer: "Maya Chen",
          street: "1842 Dahlia St",
          tone: "navy" as const,
        },
      ],
    },
    {
      id: "marcus",
      photo: "/images/crew/marcus.jpg",
      name: "Marcus Reed",
      role: "Technician",
      jobs: [
        {
          start: 11.6,
          span: 2.2,
          number: "299",
          customer: "Priya Shah",
          street: "88 Grove, Denver",
          tone: "rose" as const,
        },
      ],
    },
    {
      id: "sofia",
      photo: "/images/crew/sofia.jpg",
      name: "Sofia Nguyen",
      role: "Estimator",
      jobs: [
        {
          start: 10,
          span: 2,
          number: "375",
          customer: "Site measure",
          street: "Chen · deep clean",
          tone: "amber" as const,
        },
      ],
    },
  ];

  return (
    <div className="rounded-2xl bg-primary/[0.06] p-2.5 sm:p-3">
      <div className="overflow-hidden rounded-xl border border-black/15 bg-card shadow-[0_18px_40px_-24px_rgba(0,63,125,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-black/12 px-2 py-1 text-[11px] font-medium">
              Today
            </span>
            <span className="flex items-center">
              <span className="rounded-md p-1 text-muted-foreground">
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </span>
              <span className="rounded-md p-1 text-muted-foreground">
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </span>
            </span>
            <p className="text-[12px] font-semibold">Thu, Aug 14</p>
          </div>
          <div className="flex items-center gap-1">
            {views.map((view) => (
              <span
                key={view}
                className={cn(
                  "hidden rounded-md px-2 py-1 text-[10px] font-medium sm:inline-block",
                  view === "Timeline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {view}
              </span>
            ))}
            <span className="ml-1 hidden text-muted-foreground sm:inline-flex">
              <Settings2 className="size-3.5" aria-hidden="true" />
            </span>
            <span className="hidden text-muted-foreground sm:inline-flex">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[34rem]">
            <div className="grid grid-cols-[8.75rem_minmax(0,1fr)] border-b border-black/8">
              <div className="px-3 py-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Crew
              </div>
              <div className="grid grid-cols-7">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-l border-black/8 px-1 py-2 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {formatHour(hour)}
                  </div>
                ))}
              </div>
            </div>

            {techs.map((tech) => (
              <div
                key={tech.id}
                className="grid grid-cols-[8.75rem_minmax(0,1fr)] border-b border-black/8 last:border-b-0"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {tech.photo ? (
                    <span className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                      <Image
                        src={tech.photo}
                        alt={tech.name}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <span className="size-8 shrink-0 rounded-full border border-dashed border-black/20 bg-[#F4F7FA]" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold">{tech.name}</p>
                    {tech.role ? (
                      <p className="truncate text-[10px] text-muted-foreground">{tech.role}</p>
                    ) : null}
                  </div>
                </div>
                <div className="relative min-h-[3.65rem]">
                  <div className="absolute inset-0 grid grid-cols-7">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l border-black/[0.06]" />
                    ))}
                  </div>
                  {tech.jobs.map((job) => (
                    <div
                      key={job.number}
                      className={cn(
                        "absolute top-1.5 bottom-1.5 overflow-hidden rounded-md px-1.5 py-1",
                        scheduleToneClass[job.tone],
                      )}
                      style={{
                        left: `calc(${((job.start - startHour) / hours.length) * 100}% + 4px)`,
                        width: `calc(${(job.span / hours.length) * 100}% - 8px)`,
                      }}
                    >
                      <p className="truncate text-[9px] font-medium opacity-80">Job #{job.number}</p>
                      <p className="truncate text-[11px] font-semibold">{job.customer}</p>
                      <p className="truncate text-[9px] opacity-80">{job.street}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
