"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Minus } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import type { ProPlanBillingCycle, ProSubscriptionPlan } from "@/lib/constants/subscription-plans";
import { proPlanMonthlyRate } from "@/lib/constants/subscription-plans";
import { cn } from "@/lib/utils";

/**
 * "Compare plans" matrix on the Pro pricing page (client request). Columns are the live plans
 * from admin → Subscription Plans; every cell is worked out from that plan's own settings
 * (modules, crew seats, AI voice minutes), so the table changes when an admin edits a plan.
 * All copy is our own and only lists what Request Services actually does.
 */

type Cell = boolean | string;
type Row = { id: string; label: string; detail: string; value: (plan: ProSubscriptionPlan) => Cell };
type Group = { id: string; title: string; rows: Row[] };

const seats = (plan: ProSubscriptionPlan): Cell =>
  !plan.modules.crewLogins || plan.crewSeats === 0 ? "Owner only" : plan.crewSeats < 0 ? "Unlimited" : `Up to ${plan.crewSeats}`;

const GROUPS: Group[] = [
  {
    id: "core",
    title: "Core Access & Team",
    rows: [
      {
        id: "profile",
        label: "Public business profile",
        detail: "Your page on Request Services with services, coverage areas, hours, gallery and reviews, so local homeowners can find and contact you.",
        value: () => true,
      },
      {
        id: "portal",
        label: "Pro portal & dashboard",
        detail: "One dashboard for leads, jobs, schedule, estimates and money, with the day's priorities at the top.",
        value: (p) => p.modules.portal,
      },
      {
        id: "seats",
        label: "Technician & employee logins",
        detail: "Each crew member signs in to their own portal and sees only the jobs and visits assigned to them.",
        value: seats,
      },
      {
        id: "mobile",
        label: "Pro mobile app",
        detail: "Run the office from the truck: check the schedule, update jobs and add site photos from your phone.",
        value: (p) => p.modules.mobileApp,
      },
      {
        id: "subs",
        label: "Subcontractor portal",
        detail: "Send jobs to subcontractors, who see their assignments, request changes and track their payouts in their own portal.",
        value: (p) => p.modules.subcontractors,
      },
    ],
  },
  {
    id: "leads",
    title: "Lead & Client Management",
    rows: [
      {
        id: "matching",
        label: "Lead matching & direct requests",
        detail: "Homeowners in your service area send requests straight to you; new leads arrive with the job details already filled in.",
        value: (p) => p.modules.leads,
      },
      {
        id: "crm",
        label: "Customer records",
        detail: "Every customer with their properties, history, estimates, jobs and invoices in one place.",
        value: (p) => p.modules.portal,
      },
      {
        id: "pipeline",
        label: "Pipeline board",
        detail: "Drag each opportunity from new lead to won job, so nothing waits on a follow-up.",
        value: (p) => p.modules.portal && p.modules.leads,
      },
      {
        id: "orders",
        label: "Fixed-price service orders",
        detail: "Sell set-price services customers can book online, and manage those orders alongside your jobs.",
        value: (p) => p.modules.ordersJobs,
      },
    ],
  },
  {
    id: "schedule",
    title: "Scheduling & Dispatching",
    rows: [
      {
        id: "calendar",
        label: "Drag & drop calendar",
        detail: "Day, week and month views. Drag a visit or job to a new time, or pull its edge to make it longer.",
        value: (p) => p.modules.schedulesTimesheets,
      },
      {
        id: "hours",
        label: "Working-hours aware scheduling",
        detail: "Days you mark Closed are skipped automatically, and the schedule follows when you change your hours.",
        value: (p) => p.modules.schedulesTimesheets,
      },
      {
        id: "dispatch",
        label: "Crew assignment & dispatch",
        detail: "Assign the right technician to each job and visit, with conflict checks so nobody is double-booked.",
        value: (p) => p.modules.schedulesTimesheets && p.modules.crewLogins && p.crewSeats !== 0,
      },
      {
        id: "timesheets",
        label: "Timesheets",
        detail: "Crew clock in and out on the job, and you review hours before payroll.",
        value: (p) => p.modules.schedulesTimesheets,
      },
    ],
  },
  {
    id: "jobs",
    title: "Job & Project Management",
    rows: [
      {
        id: "jobs",
        label: "Jobs & work orders",
        detail: "Turn an accepted estimate into a job in one click, with the crew, dates and notes carried over.",
        value: (p) => p.modules.ordersJobs,
      },
      {
        id: "stages",
        label: "Project stages & customer timeline",
        detail: "Split bigger projects into stages (demo, rough-in, tile…) with their own time; customers follow the progress.",
        value: (p) => p.modules.estimatesInvoices,
      },
      {
        id: "tasks",
        label: "Tasks & reminders",
        detail: "Give yourself or a teammate a to-do with a due date, and see it on the calendar.",
        value: (p) => p.modules.portal,
      },
      {
        id: "files",
        label: "Job photos & files",
        detail: "Keep site photos, documents and field notes with the job, so the whole crew sees the same information.",
        value: (p) => p.modules.ordersJobs,
      },
    ],
  },
  {
    id: "money",
    title: "Estimates, Invoicing & Payments",
    rows: [
      {
        id: "estimates",
        label: "Sectioned estimate builder",
        detail: "Labor and materials grouped by trade section with subtotals, templates and optional add-ons.",
        value: (p) => p.modules.estimatesInvoices,
      },
      {
        id: "esign",
        label: "Online approval & e-signature",
        detail: "Customers review, request changes or approve and sign the estimate online.",
        value: (p) => p.modules.estimatesInvoices,
      },
      {
        id: "invoices",
        label: "Invoices & online payments",
        detail: "Send invoices from the job and get paid online; payments are matched to the invoice automatically.",
        value: (p) => p.modules.estimatesInvoices,
      },
    ],
  },
  {
    id: "ai",
    title: "Pro Co-pilot & AI Tools",
    rows: [
      {
        id: "voice",
        label: "24/7 AI Voice Receptionist",
        detail: "Answers calls in your company's name, collects the job details and saves a draft for you to review.",
        value: (p) => (p.callingMinutes > 0 ? `${p.callingMinutes.toLocaleString("en-US")} min / mo` : false),
      },
      {
        id: "number",
        label: "Dedicated business phone number",
        detail: "A number for your AI receptionist; keep your existing number and forward calls to it when you like.",
        value: (p) => p.callingMinutes > 0,
      },
      {
        id: "copilot",
        label: "Pro Co-pilot assistant",
        detail: "Ask in plain words (“who is free tomorrow?”, “open overdue invoices”) and it finds or opens what you need.",
        value: (p) => p.modules.portal,
      },
      {
        id: "vision",
        label: "AI estimates from site photos",
        detail: "Send a few job-site photos and get an itemized, sectioned draft priced for your market, ready to edit.",
        value: (p) => p.modules.portal && p.modules.estimatesInvoices,
      },
    ],
  },
];

function CellValue({ value, planName }: { value: Cell; planName: string }) {
  if (value === true) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Included in {planName}</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex size-6 items-center justify-center text-muted-foreground/50">
        <Minus className="size-4" aria-hidden />
        <span className="sr-only">Not included in {planName}</span>
      </span>
    );
  }
  return <span className="text-xs font-medium text-foreground sm:text-sm">{value}</span>;
}

function FeatureRow({ row, plans, columns }: { row: Row; plans: ProSubscriptionPlan[]; columns: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-t border-border first:border-t-0" style={{ display: "grid", gridTemplateColumns: columns }}>
      <div className="min-w-0 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-center justify-between gap-2 rounded-md text-left text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{row.label}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-primary", open && "rotate-180 text-primary")}
            aria-hidden
          />
        </button>
        {/* Smooth expand: grid rows 0fr → 1fr. */}
        <div
          id={panelId}
          role="region"
          aria-label={`${row.label} details`}
          className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        >
          <p className={cn("overflow-hidden text-xs leading-5 text-muted-foreground sm:text-[13px]", open && "pt-1.5")}>{row.detail}</p>
        </div>
      </div>
      {plans.map((plan) => (
        <div key={plan.id} className={cn("flex items-start justify-center px-2 py-3 text-center", plan.highlighted && "bg-primary/[0.04]")}>
          <CellValue value={row.value(plan)} planName={plan.name} />
        </div>
      ))}
    </div>
  );
}

export function ComparePlans({
  plans,
  cycle,
  ctaFor,
}: {
  plans: ProSubscriptionPlan[];
  cycle: ProPlanBillingCycle;
  /** Same CTA as the plan cards (guest → register with the plan, Pro → Subscription). */
  ctaFor: (plan: ProSubscriptionPlan) => { href: string; label: string };
}) {
  // Phones: one plan column at a time (picked with the tabs); wider screens: every plan.
  const [mobilePlanId, setMobilePlanId] = useState<string | null>(null);
  if (!plans.length) return null;
  const mobilePlan = plans.find((p) => p.id === mobilePlanId) || plans.find((p) => p.highlighted) || plans[0];

  const render = (shown: ProSubscriptionPlan[], className: string, view: "wide" | "single") => {
    const columns = `minmax(11rem, 1.7fr) repeat(${shown.length}, minmax(0, 1fr))`;
    return (
      <div className={className} data-compare={view}>
        {/* Plan headers stay in view while scrolling the table (under the 68px site header). */}
        <div
          className="sticky top-17 z-20 rounded-t-2xl border border-border bg-card/95 shadow-[0_6px_14px_-12px_rgba(15,23,42,0.35)] backdrop-blur"
          style={{ display: "grid", gridTemplateColumns: columns }}
        >
          <div className="flex items-end px-4 py-4 sm:px-5">
            <span className="text-sm font-semibold text-foreground">Compare plans</span>
          </div>
          {shown.map((plan) => {
            const cta = ctaFor(plan);
            const price = proPlanMonthlyRate(plan, cycle);
            return (
              <div key={plan.id} className={cn("flex flex-col items-center gap-2 px-2 py-4 text-center", plan.highlighted && "bg-primary/[0.04]")}>
                <span className="text-sm font-semibold tracking-wide text-foreground uppercase">{plan.name}</span>
                <span className="text-xs text-muted-foreground">
                  {price === 0 ? "Free" : `$${price.toFixed(2)} / mo`}
                  {price && cycle === "annual" ? " billed yearly" : ""}
                </span>
                <Button asChild size="sm" variant={plan.highlighted ? "default" : "outline"} className="w-full max-w-36 rounded-lg">
                  <Link href={cta.href}>{plan.monthlyPrice === 0 ? "Start for free" : "Get started"}</Link>
                </Button>
              </div>
            );
          })}
        </div>
        <div className="overflow-hidden rounded-b-2xl border border-t-0 border-border bg-card">
          {GROUPS.map((group) => (
            <div key={group.id} role="rowgroup" aria-label={group.title}>
              <div className="border-t border-border bg-muted/60 px-4 py-2.5 text-sm font-semibold text-foreground sm:px-5">{group.title}</div>
              {group.rows.map((row) => (
                <FeatureRow key={row.id} row={row} plans={shown} columns={columns} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Section id="compare" density="tight">
      <Container className="flex flex-col gap-6">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="eyebrow text-primary">Compare plans</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-[2.5rem]">See what each plan includes</h2>
          <p className="text-sm leading-7 text-muted-foreground">Tap any feature to see how it helps you run the business.</p>
        </div>

        {/* Phones: plan tabs + one column. */}
        <div className="md:hidden">
          <div role="tablist" aria-label="Choose a plan to compare" className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/50 p-1 min-[420px]:grid-cols-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                role="tab"
                aria-selected={plan.id === mobilePlan.id}
                onClick={() => setMobilePlanId(plan.id)}
                className={cn(
                  "min-h-10 rounded-lg px-2 text-xs font-semibold transition",
                  plan.id === mobilePlan.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {plan.name}
              </button>
            ))}
          </div>
          {render([mobilePlan], "", "single")}
        </div>
        {render(plans, "hidden md:block", "wide")}
      </Container>
    </Section>
  );
}
