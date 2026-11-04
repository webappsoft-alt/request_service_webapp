"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { DASHBOARD_MOCKS } from "@/components/pro-v1/pro-dashboard-mocks";
import { proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/** Options from the pro dashboard sidebar, in sidebar order. */
const FEATURES = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Start every day knowing what's next",
    body: "Overdue invoices, unassigned jobs, urgent leads, and your team's day are on one screen, so you can see what to handle first.",
    alt: "Pro dashboard with items needing attention, important actions, team locations, and AI call activity",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    title: "Move every job forward",
    body: "Leads, estimates, scheduled jobs, work in progress, and invoices sit on one board. Drag a card along and your customers and crew are notified.",
    alt: "Pipeline board with columns for leads, estimates, scheduled jobs, jobs in progress, and invoices",
  },
  {
    id: "customers",
    label: "Customers",
    title: "Every customer's file in one place",
    body: "Addresses, contact details, lead source, and what they owe, one click away from their full history.",
    alt: "Customers table with address, email, phone, source, and amount owing",
  },
  {
    id: "employees",
    label: "Employees",
    title: "Your whole crew, set up in one list",
    body: "Manage roles, technician logins, pay rates, hours, and assigned work for your office and field team.",
    alt: "Employees table with role, login, pay rate, and hours",
  },
  {
    id: "contractors",
    label: "Contractors",
    title: "Subs you can trust on the job",
    body: "Keep each subcontractor's license, insurance, and paperwork on file, assign them to jobs, and track their hours and pay.",
    alt: "Contractor file with a compliance checklist and a job assignment",
  },
  {
    id: "vendors",
    label: "Vendors",
    title: "Suppliers and purchase orders together",
    body: "Keep account terms for each supply house and build purchase orders tied to the jobs they're for.",
    alt: "Purchase order with line items, total, and status",
  },
  {
    id: "timesheets",
    label: "Timesheets",
    title: "Hours and pay, week by week",
    body: "Review clocked sessions for every technician, compare crews, and see exactly what you still owe.",
    alt: "Timesheets week board with total hours, pay, and sessions per technician",
  },
  {
    id: "tracking",
    label: "Employee tracking",
    title: "See your crew in the field",
    body: "Follow employees on a live map while they're on the clock, with on-site arrival checked against the job's location.",
    alt: "Map with a technician driving to a job site and arriving inside its geofence",
  },
  {
    id: "reminders",
    label: "Reminders",
    title: "Follow-ups that don't slip",
    body: "Schedule reminders for calls, orders, and invoices and tie each one to the customer or job it's about.",
    alt: "List of today's reminders being completed one by one",
  },
  {
    id: "leads",
    label: "Leads",
    title: "Every lead lands in one inbox",
    body: "Website quote requests, chat, and phone leads come to the same list. Open one to see their answers, discuss the work, and send an estimate.",
    alt: "Leads table with customer, service, address, and status",
  },
  {
    id: "messages",
    label: "Messages",
    title: "Customer and crew chat in one inbox",
    body: "Message customers, leads, and your technicians from one place, with each conversation kept with their file.",
    alt: "Chat thread with a customer about an upcoming visit",
  },
  {
    id: "estimates",
    label: "Estimate",
    title: "Turn requests into written estimates",
    body: "Go from customer to property, work request, optional site assessment, and estimate, and see the status of every one you've sent.",
    alt: "Estimates table with customer, address, preparation, and status",
  },
  {
    id: "jobs",
    label: "Jobs",
    title: "Approved estimates become jobs",
    body: "Fixed services booked on the website skip the estimate and land here ready to start, with the team member, dates, and total on each.",
    alt: "Jobs table with customer, service, dates, team member, and total",
  },
  {
    id: "tasks",
    label: "Tasks",
    title: "Your team's tasks, checked off",
    body: "Create tasks across customers and jobs, assign them to your team, and see what's done and what's overdue.",
    alt: "Task list with assignees and a progress bar",
  },
  {
    id: "schedules",
    label: "Schedules",
    title: "Plan the month, week, or day",
    body: "See jobs, estimates, site visits, invoices, and tasks on one calendar. Drag a job to any time, or pull the edge to extend it.",
    alt: "Month calendar with color-coded jobs, invoices, payments, and tasks",
  },
  {
    id: "orders",
    label: "Fixed service orders",
    title: "Bookings for your set-price services",
    body: "Customers book your fixed services from your profile. Accept, schedule, and complete each order from one list.",
    alt: "Fixed service order moving from new to accepted, scheduled, and completed",
  },
  {
    id: "invoices",
    label: "Invoices",
    title: "Bill exactly what was agreed",
    body: "Each invoice keeps the original estimate plus approved extras, with due dates, days overdue, and the balance in view.",
    alt: "Invoices table with status, due date, days overdue, price, and balance",
  },
  {
    id: "payments",
    label: "Payments",
    title: "Every payment, matched to its invoice",
    body: "Deposits, progress payments, and completion balances are recorded against the invoice they belong to.",
    alt: "Payments table with date, status, method, amount, and invoice number",
  },
  {
    id: "profile",
    label: "Business Profile",
    title: "A public profile that wins the job",
    body: "Show customers your services, hours, coverage, and license and insurance status on the page they book from.",
    alt: "Public business profile with verification badges, services, and hours",
  },
  {
    id: "ai-receptionist",
    label: "AI Receptionist",
    ai: true,
    title: "Answer every call, even on the job",
    body: "Your AI receptionist answers on your own number, captures the lead, drafts an estimate for you to review, and transfers callers who ask for a person.",
    alt: "AI Receptionist settings with phone number, voices, greeting, and recent calls",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    title: "Let your past work sell the next job",
    body: "Add photos of finished projects to your profile so customers can see the quality before they ask for a quote.",
    alt: "Grid of past project photos",
  },
  {
    id: "service-areas",
    label: "Service areas",
    title: "Choose exactly where you take work",
    body: "Pick the cities you serve and the ZIP codes that come with them, so you get requests from the places you want to work.",
    alt: "Map with service cities and the ZIP codes they cover",
  },
  {
    id: "fixed-services",
    label: "Fixed services",
    title: "Sell set-price work from your profile",
    body: "List priced services that customers can request from your profile, with photos, coverage, areas, and hours for each.",
    alt: "Fixed services catalog with photos, categories, and prices",
  },
  {
    id: "reports",
    label: "Reports",
    title: "Know where the money stands",
    body: "See what's collected and outstanding, how many estimates are accepted, and how work moves from request to paid invoice.",
    alt: "Reports with collected, outstanding, estimate conversion, monthly volume, and pipeline",
  },
] as const;

/**
 * Pro landing (for-pros-v1): the pro dashboard, one sidebar option at a time. Plain text tabs with
 * a highlight (animated primary border) that slides to the active one, over a soft panel: that
 * tab's own animated visual beside its copy on a white card. Moves to the next tab after one pass,
 * while on screen, until a tab is clicked.
 */
export function ProFeatureTabs() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);
  const [highlight, setHighlight] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const feature = FEATURES[active];
  const { Mock, loopMs } = DASHBOARD_MOCKS[feature.id];
  const isCall = feature.id === "ai-receptionist";

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      {
        threshold: 0.3,
      },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pinned || !inView) return;
    const timer = window.setTimeout(
      () => setActive((index) => (index + 1) % FEATURES.length),
      loopMs,
    );
    return () => window.clearTimeout(timer);
  }, [active, loopMs, pinned, inView]);

  // The tabs rewrap with the width (and the font can load late), so re-measure on resize.
  useEffect(() => {
    const list = tabListRef.current;
    const tab = tabRefs.current[active];
    if (!list || !tab) return;
    const measure = () =>
      setHighlight({
        left: tab.offsetLeft,
        top: tab.offsetTop,
        width: tab.offsetWidth,
        height: tab.offsetHeight,
      });
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
    <Section id="how-it-works" className="scroll-mt-24 bg-background">
      <Container ref={rootRef} className="flex flex-col gap-8">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Pro dashboard options"
          className="relative mx-auto flex max-w-5xl flex-wrap justify-center gap-1"
        >
          {highlight ? (
            <span
              aria-hidden="true"
              className="rs-tab-active"
              style={highlight}
            />
          ) : null}
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
                id={`feature-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls="feature-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(index)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {"ai" in tab ? (
                  <Sparkles className="size-3.5" aria-hidden="true" />
                ) : null}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id="feature-panel"
          role="tabpanel"
          aria-labelledby={`feature-tab-${feature.id}`}
          className="overflow-hidden rounded-3xl border border-border/70 bg-background"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div
              role="img"
              aria-label={feature.alt}
              className={cn(
                "rs-stage @container relative order-last overflow-hidden sm:h-104 lg:order-first",
                !isCall && "h-96",
              )}
            >
              <div
                key={feature.id}
                className={cn(
                  "animate-in fade-in inset-0 duration-200 sm:absolute",
                  !isCall && "absolute",
                )}
              >
                <Mock />
              </div>
            </div>

            <div
              key={feature.id}
              className="animate-in fade-in flex flex-col items-start justify-center gap-3 bg-background p-6 duration-200 sm:p-8 lg:p-10"
            >
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                {feature.label}
              </p>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-[1.75rem] md:leading-[1.2]">
                {feature.title}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {feature.body}
              </p>
              <Link
                href={proPaths.register}
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
              >
                Create your account
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
