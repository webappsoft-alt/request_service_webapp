import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  Columns3,
  Handshake,
  LayoutDashboard,
  MapPinned,
  Timer,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Shared pro portal frame ─────────────────────────── */

/** A slice of the real pro sidebar (lib/data/portal-nav). */
const PRO_NAV = [
  { group: "", items: [{ icon: LayoutDashboard, label: "Dashboard" }, { icon: Columns3, label: "Pipeline" }] },
  {
    group: "People",
    items: [
      { icon: UserRound, label: "Employees" },
      { icon: Handshake, label: "Contractors" },
      { icon: Timer, label: "Timesheets" },
      { icon: MapPinned, label: "Employee tracking" },
    ],
  },
  {
    group: "Work",
    items: [
      { icon: Briefcase, label: "Jobs" },
      { icon: CalendarDays, label: "Schedules" },
    ],
  },
] as const;

type NavLabel = (typeof PRO_NAV)[number]["items"][number]["label"];

/** The pro portal shell: blue sidebar with `active` highlighted, page header, then `children`. */
function ProPortalFrame({
  active,
  eyebrow,
  title,
  label,
  children,
}: {
  active: NavLabel;
  eyebrow: string;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      data-light
      className="flex overflow-hidden rounded-[1.25rem] border border-border bg-muted/60 text-left shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)]"
    >
      <aside className="hidden w-44 shrink-0 flex-col bg-primary text-primary-foreground md:flex">
        <div className="border-b border-white/10 px-3.5 py-3">
          <p className="truncate text-xs font-semibold">Summit Home Services</p>
          <p className="text-[9px] text-white/60">Request Service</p>
        </div>
        <div className="flex flex-col gap-2 p-2">
          {PRO_NAV.map((section) => (
            <div key={section.group || "main"}>
              {section.group ? (
                <p className="px-2 pt-1 pb-1 text-[8px] font-semibold tracking-[0.16em] text-white/50 uppercase">{section.group}</p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const on = item.label === active;
                  return (
                    <li
                      key={item.label}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.25 text-[10px]",
                        on ? "bg-white/15 font-semibold text-white" : "text-white/80",
                      )}
                    >
                      <Icon className="size-3 shrink-0" aria-hidden="true" />
                      {item.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 bg-[#f4f6fa] p-3 text-slate-900 sm:p-3.5">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
          <p className="text-[8px] font-semibold tracking-[0.16em] text-slate-500 uppercase">{eyebrow}</p>
          <p className="text-sm font-semibold tracking-tight">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Status pill colours for the timesheet preview. */
const STATUS_TONES = {
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
} as const;

/* ─────────────────────────── Team, timesheets & tracking ─────────────────────────── */

const TEAM_POINTS = [
  { icon: UserRound, title: "Employees & roles", body: "Office and technician logins — each sees only what the role allows." },
  { icon: Timer, title: "Timesheets", body: "Every clocked hour, week by week, with each session to review." },
  { icon: MapPinned, title: "Employee tracking", body: "Live location and daily route — recorded only while clocked in." },
  { icon: Wallet, title: "Pay from the timesheet", body: "Hours times rate, minus what's paid. Mark it paid in one click." },
] as const;

const PINS = [
  { initials: "TR", name: "Tate R.", note: "JOB-333 · 2h 14m", x: 62, y: 38, live: true },
  { initials: "AC", name: "Aisha C.", note: "Driving · 12 min", x: 30, y: 64, live: true },
  { initials: "FR", name: "Front Range", note: "JOB-842 · sub", x: 80, y: 74, live: false },
] as const;

const WEEK = [
  { name: "Tate R.", hours: [8.2, 7.9, 8.5, 6.1, 4.3], pay: "Owed $112.50", tone: STATUS_TONES.amber },
  { name: "Aisha Carter", hours: [7.5, 8.0, 8.0, 7.8, 5.2], pay: "Paid", tone: STATUS_TONES.green },
  { name: "Luis Romero", hours: [6.0, 8.1, 0, 8.4, 7.7], pay: "Paid", tone: STATUS_TONES.green },
] as const;

/**
 * Pro landing (for-pros-v1): employees, timesheets, and live tracking — copy on the left, and the
 * pro portal frame on the right with the tracking map (people and a route) over a week's timesheet.
 */
export function ProTeamTimeSection() {
  return (
    <Section id="team" className="relative scroll-mt-24 bg-muted/50">
      <Container className="relative flex flex-col gap-10">
        {/* Heading row */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
          <div className="flex flex-col gap-3">
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Users className="size-3.5" aria-hidden="true" />
              Employees · Timesheets · Tracking
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.1]">
              Know who&apos;s where — and pay what&apos;s owed.
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Your people, their hours, and where they are right now — in the same portal as your jobs. No calling around,
              no paper timecards.
            </p>
            <Link
              href={proPaths.register}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Add your team free
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
          <ul className="grid gap-3 sm:grid-cols-2">
            {TEAM_POINTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-[13px] leading-5 text-muted-foreground">{item.body}</p>
                </li>
              );
            })}
          </ul>

        <div className="min-w-0">
          <ProPortalFrame
            active="Employee tracking"
            eyebrow="People / Tracking"
            title="Employee tracking"
            label="Employee tracking map with two technicians clocked in and a subcontractor on site, a route line, and this week's timesheet with hours and pay status"
          >
            {/* Map */}
            <div className="relative h-44 overflow-hidden rounded-xl border border-slate-200 bg-[#eef2f6] sm:h-48">
              <svg viewBox="0 0 400 220" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
                <rect x="250" y="20" width="90" height="55" rx="6" fill="#dcefe1" />
                <rect x="30" y="140" width="70" height="50" rx="6" fill="#dcefe1" />
                {[40, 95, 150, 195].map((y) => (
                  <line key={`h${y}`} x1="0" y1={y} x2="400" y2={y} stroke="#ffffff" strokeWidth="7" />
                ))}
                {[60, 140, 220, 300, 360].map((x) => (
                  <line key={`v${x}`} x1={x} y1="0" x2={x} y2="220" stroke="#ffffff" strokeWidth="7" />
                ))}
                <line x1="0" y1="210" x2="400" y2="10" stroke="#fde68a" strokeWidth="9" />
                <polyline
                  points="120,141 140,141 140,95 220,95 220,84 248,84"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1 7"
                />
              </svg>
              {PINS.map((pin) => (
                <div key={pin.initials} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
                  <span className="relative flex size-7 items-center justify-center">
                    {pin.live ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 motion-reduce:animate-none" /> : null}
                    <span
                      className={cn(
                        "relative flex size-7 items-center justify-center rounded-full text-[9px] font-bold ring-2 ring-white",
                        pin.live ? "bg-primary text-primary-foreground" : "bg-[#0f7b68] text-white",
                      )}
                    >
                      {pin.initials}
                    </span>
                  </span>
                  <span className="absolute top-8 left-1/2 -translate-x-1/2 rounded-md bg-white px-1.5 py-0.5 text-[8px] whitespace-nowrap shadow-sm">
                    <span className="font-semibold">{pin.name}</span> · {pin.note}
                  </span>
                </div>
              ))}
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 shadow-sm">
                <span className="size-1.5 rounded-full bg-emerald-500" /> 3 on the clock
              </span>
            </div>

            {/* Timesheet */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <p className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] font-semibold">
                Timesheets · this week
                <span className="text-[9px] font-medium text-primary">Pay owed</span>
              </p>
              <table className="w-full text-[10px]">
                <thead className="text-[8px] tracking-[0.12em] text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-semibold">Employee</th>
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
                      <th key={day} className="hidden px-1 py-1.5 text-right font-semibold sm:table-cell">
                        {day}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-semibold">Total</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold whitespace-nowrap">{row.name}</td>
                      {row.hours.map((value, index) => (
                        <td key={index} className="hidden px-1 py-1.5 text-right text-slate-600 tabular-nums sm:table-cell">
                          {value ? value.toFixed(1) : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {row.hours.reduce<number>((sum, value) => sum + value, 0).toFixed(1)}h
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={cn("rounded-full px-1.5 py-px text-[8px] font-semibold whitespace-nowrap", row.tone)}>{row.pay}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ProPortalFrame>
        </div>
        </div>
      </Container>
    </Section>
  );
}
