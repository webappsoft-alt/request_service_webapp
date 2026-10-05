"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { ProScreenshot } from "@/components/pro/pro-screenshot";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

type DeskTab = {
  id: string;
  tab: string;
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  shot: string;
  /** Pixel size of the exported image when it is not the standard 1920×1200. */
  shotWidth?: number;
  shotHeight?: number;
  alt: string;
  url: string;
  mobileShot?: string;
  mobileAlt?: string;
};

const tabs: readonly DeskTab[] = [
  {
    id: "dashboard",
    tab: "Dashboard",
    eyebrow: "Dashboard",
    title: "What needs attention today, before the first call.",
    body: "Overdue invoices, uninvoiced jobs, unassigned work, and overdue tasks on top. Below it, the lead pipeline, incoming requests, revenue, and recent messages — with Main, Sales, and Service views.",
    points: [
      "Today / this week / this month switch",
      "Sales view for pipeline and conversion, Service view for crews and jobs",
      "Every tile links straight to the record behind it",
    ],
    shot: "dashboard-sales",
    alt: "Sales dashboard with pipeline, conversion, and estimate totals",
    url: "…/pro/dashboard/sales",
  },
  {
    id: "customers",
    tab: "Customers",
    eyebrow: "Customers",
    title: "Every past job sits on the same person.",
    body: "Residential and commercial customers with contact details, a map of the service address, amount owing, and tabs for estimates, jobs, schedules, invoices, history, notes, tasks, and reminders.",
    points: [
      "Source tracking: website, referral, phone, repeat",
      "The next estimate starts from history, not a blank page",
      "Notes from the last visit stay with the address",
    ],
    shot: "customer-detail",
    alt: "Customer profile with contact details, account balance, and a map of the job site",
    url: "…/pro/dashboard/customers",
  },
  {
    id: "team",
    tab: "Employees",
    eyebrow: "Employees",
    title: "Office and field on one roster.",
    body: "Technicians, estimators, dispatchers, and office staff with roles, contact details, and the jobs they are on. Assign work without a text thread.",
    points: [
      "Who is free before you put a job on the day",
      "The name on the calendar is the name on the job file",
      "Per-person detail with schedule, notes, and attachments",
    ],
    shot: "employees",
    alt: "Employees list with roles, contact details, and status",
    url: "…/pro/dashboard/team",
  },
  {
    id: "contractors",
    tab: "Contractors",
    eyebrow: "Contractors",
    title: "Subs you trust, assignable like your own crew.",
    body: "Keep roofing, electrical, or landscaping partners on file with trade, rate, insurance, and contact. Hand them a job from the same board your employees use.",
    points: [
      "Trade and specialty on each contractor",
      "Assign a contractor to a job in one step",
      "Notes and documents stay on the contractor record",
    ],
    shot: "contractors",
    alt: "Contractors list with trade, contact, and status",
    url: "…/pro/dashboard/contractors",
  },
  {
    id: "vendors",
    tab: "Vendors",
    eyebrow: "Vendors & inventory",
    title: "Suppliers, parts, and purchase orders.",
    body: "Your supply houses on one list with the parts you buy from them, stock on hand, and purchase orders. Materials on a job can be tied back to where they came from.",
    points: [
      "Inventory items with SKU, cost, and stock",
      "Purchase orders per vendor",
      "Account rep and terms on each vendor",
    ],
    shot: "vendors",
    alt: "Vendors list showing suppliers, categories, and contact details",
    url: "…/pro/dashboard/vendors",
  },
  {
    id: "reminders",
    tab: "Reminders & tasks",
    eyebrow: "Reminders & tasks",
    title: "Follow-ups that don't live in someone's head.",
    body: "Tasks with owners, due dates, and priority; reminders tied to a customer, job, or invoice. Overdue items surface on the dashboard until someone clears them.",
    points: [
      "Assign tasks to a team member with a due date",
      "Reminders for permits, callbacks, maintenance, and payment",
      "Everything shows on the schedule too",
    ],
    shot: "tasks",
    alt: "Tasks board with assignees, priority, due dates, and status",
    url: "…/pro/dashboard/tasks",
  },
  {
    id: "booking",
    tab: "Online booking",
    eyebrow: "Fixed services & online booking",
    title: "Price it once. Let them book it.",
    body: "Publish fixed-price services — a water heater flush, a drain cleaning, a tune-up — on your public profile. Homeowners pick a slot inside your working hours and the order lands on your board as work ready to start.",
    points: [
      "Fixed-price catalog with photos and what's included",
      "Instant booking or review-then-confirm",
      "Order moves on the way → arrived → in progress → complete",
    ],
    shot: "orders",
    alt: "Fixed service orders list with booked services, customers, and status",
    url: "…/pro/dashboard/orders",
  },
  {
    id: "payments",
    tab: "Payments",
    eyebrow: "Payments",
    title: "Deposit, progress, then the balance.",
    body: "Every payment sits on its invoice until the job is settled. Card, check, cash, or transfer — each one logged with the date, method, and who recorded it.",
    points: [
      "Take a deposit when they accept",
      "Progress payments stay on the same invoice",
      "The remaining balance is never a guess",
    ],
    shot: "payments",
    alt: "Payments list with invoice, customer, method, and amount",
    url: "…/pro/dashboard/payments",
  },
  {
    id: "profile",
    tab: "Business profile",
    eyebrow: "Business profile & portfolio",
    title: "The listing homeowners find you on.",
    body: "Company details, licenses, working hours, service categories, gallery, and a portfolio of finished projects. It feeds your public page and every estimate header.",
    points: [
      "Licensed and insured badges, years in business, team size",
      "Portfolio projects with photos and the work done",
      "Edit any section without touching the rest",
    ],
    shot: "business-profile",
    alt: "Business profile with company details, services offered, and working hours",
    url: "…/pro/dashboard/settings",
  },
  {
    id: "areas",
    tab: "Service areas",
    eyebrow: "Service areas",
    title: "Only the streets you actually cover.",
    body: "Pick cities and neighborhoods; requests route to you only when the address is inside your coverage.",
    points: [
      "Neighborhood-level coverage per city",
      "Requests outside your area never hit your inbox",
      "Coverage shows on your public profile",
    ],
    shot: "service-areas",
    alt: "Service areas list with covered neighborhoods, cities, and ZIP codes",
    url: "…/pro/dashboard/service-areas",
  },
  {
    id: "reporting",
    tab: "Reports",
    eyebrow: "Reports",
    title: "The month, without a second spreadsheet.",
    body: "Collected, outstanding, estimate conversion, active jobs, monthly volume, and the pipeline from request to paid invoice — the questions an owner asks at month end.",
    points: [
      "Volume and cash on one view",
      "Request mix and money on the books",
      "Export the report when the accountant asks",
    ],
    shot: "reports",
    alt: "Reports with collected, outstanding, estimate conversion, and monthly volume chart",
    url: "…/pro/dashboard/reports",
  },
  {
    id: "public",
    tab: "Public profile",
    eyebrow: "Public profile",
    title: "Your page on the marketplace.",
    body: "Everything from your business profile — services, fixed-price bookings, portfolio, coverage, hours, reviews — on a page homeowners can request from directly.",
    points: [
      "Request an estimate and book fixed services from the same page",
      "Portfolio and gallery pulled from your portal",
      "Licensed / insured badges and service area shown",
    ],
    shot: "public-profile",
    shotWidth: 1600,
    shotHeight: 1667,
    alt: "Public professional profile page as homeowners see it",
    url: "requestservices.com/professionals/…",
  },
  {
    id: "mobile",
    tab: "On your phone",
    eyebrow: "Works on any device",
    title: "The whole desk, from the truck.",
    body: "The portal is built for the phone as much as the office. Technicians open today's jobs, update status from the driveway, and message the customer — the same records, no second app to install.",
    points: [
      "Today's jobs in time order, next stop on top",
      "Tap a job for the address and the approved scope",
      "Status updates reach the office without a call",
    ],
    shot: "job-detail-completed",
    alt: "Completed job detail on desktop",
    url: "…/pro/dashboard/jobs",
    mobileShot: "m-job-detail",
    mobileAlt: "The same job open on a phone",
  },
];

function DeskTabButton({
  tab,
  active,
  onSelect,
}: {
  tab: DeskTab;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(tab.id)}
      className={cn(
        "cursor-pointer rounded-md border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground hover:border-primary/40",
      )}
    >
      {tab.tab}
    </button>
  );
}

export function ProDeskTabs() {
  const [active, setActive] = useState<string>(tabs[0].id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
        <p className="eyebrow text-primary">Also included</p>
        <h3 className="text-2xl font-semibold tracking-tight md:text-[1.85rem]">
          Everything the team needs after the estimate.
        </h3>
        <p className="text-sm leading-7 text-muted-foreground">
          Every plan includes the full portal. Pick a tab to see the real screen.
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap justify-center gap-2">
        {tabs.map((tab) => (
          <DeskTabButton key={tab.id} tab={tab} active={tab.id === active} onSelect={setActive} />
        ))}
      </div>

      <div className="grid w-full items-start gap-10 rounded-2xl border border-input bg-[#eef3f8] px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-12">
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

        <ProScreenshot
          key={current.id}
          name={current.shot}
          alt={current.alt}
          width={current.shotWidth}
          height={current.shotHeight}
          url={current.url}
          mobileName={current.mobileShot}
          mobileAlt={current.mobileAlt}
          sizes="(min-width: 1024px) 58vw, 100vw"
        />
      </div>
    </div>
  );
}
