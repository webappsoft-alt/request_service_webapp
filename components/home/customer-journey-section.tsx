"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileSignature,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const SHOT_DIR = "/marketing/customer";
/** Customer dashboard captures are 1440×900 @2x, exported at 1920×1200. */
const SHOT = { width: 1920, height: 1200 } as const;

const screens = [
  {
    id: "request-quote-v3",
    icon: ClipboardList,
    label: "Get a quote",
    title: "A few guided questions, not a blank form",
    body: "Pick the service, describe the job and add your ZIP. We show a typical starting range and the licensed companies that cover your area.",
    points: [
      "Questions change based on the service you pick",
      "Typical starting range before you submit",
      "Only licensed pros who cover your ZIP get the request",
    ],
    url: "requestservices.com/get-a-quote",
    alt: "Get a quote form asking which service you need, with next steps and trust notes alongside",
  },
  {
    id: "pro-profile",
    icon: BadgeCheck,
    label: "Pro profile",
    title: "Know who you're hiring before they arrive",
    body: "Verified business details, photos of real work, years in business, team size and payment methods — all on one public profile.",
    points: [
      "Business verified badge and contact details",
      "Photos of real jobs, not stock images",
      "Years in business, team size, and how they take payment",
    ],
    url: "requestservices.com/professionals/summit-home-services",
    alt: "Public professional profile with photo gallery and verified business information",
  },
  {
    id: "overview",
    icon: LayoutDashboard,
    label: "Overview",
    title: "Everything about your home in one place",
    body: "Open requests, estimates waiting on you, booked orders and invoices — one page, no digging through email.",
    points: [
      "Counts for requests, estimates, orders, and invoices",
      "What's waiting on you, at a glance",
      "Jump straight into the item that needs attention",
    ],
    url: "requestservices.com/account/dashboard",
    alt: "Customer dashboard overview with quote requests, estimates to review, recent orders and invoices",
  },
  {
    id: "quote-requests",
    icon: Send,
    label: "Quote requests",
    title: "Know exactly who received your request",
    body: "Each request shows which local pros were notified, who has viewed it, and how many estimates came back.",
    points: [
      "Marketplace or direct — labeled on every row",
      "See how many pros were notified and viewed",
      "Track status from sent to converted to job",
    ],
    url: "requestservices.com/account/dashboard/requests",
    alt: "Quote requests table showing service, address, status, notified pros and estimate counts",
  },
  {
    id: "estimates",
    icon: FileText,
    label: "Estimates",
    title: "Compare written proposals side by side",
    body: "Every estimate lists the professional, status and total. Message the pro straight from the row.",
    points: [
      "Totals and status in one list",
      "Message the pro without leaving the page",
      "Open any estimate to review the full scope",
    ],
    url: "requestservices.com/account/dashboard/estimates",
    alt: "Estimates list with professional, status, message button and totals",
  },
  {
    id: "review-estimate",
    icon: FileSignature,
    label: "Review & sign",
    title: "Read the full scope before you accept",
    body: "Line items, quantities, notes and totals. Accept, request changes or decline — all in writing.",
    points: [
      "Line items with labor, materials, and amounts",
      "Accept, request changes, or decline online",
      "What you sign becomes the job and the invoice",
    ],
    url: "requestservices.com/account/dashboard/estimates/EST-408",
    alt: "Estimate review page with work details table, totals and accept / request changes actions",
  },
  {
    id: "messages",
    icon: MessageSquare,
    label: "Messages",
    title: "Conversations tied to the job they're about",
    body: "Chat with your pro about a specific request. Photos, PDFs and decisions stay attached to that project.",
    points: [
      "Each chat is linked to a request or estimate",
      "Share photos and PDFs in the thread",
      "No lost texts — history stays on the project",
    ],
    url: "requestservices.com/account/dashboard/messages",
    alt: "Messages view with a conversation about a kitchen plumbing rough-in estimate",
  },
  {
    id: "invoices",
    icon: Receipt,
    label: "Invoices",
    title: "Pay against a clear balance",
    body: "Invoices show what was billed, what's paid and what's left — always matched to the estimate you approved.",
    points: [
      "Total, paid, and remaining balance on each row",
      "Matched to the estimate you already signed",
      "Export or open any invoice when you need it",
    ],
    url: "requestservices.com/account/dashboard/invoices",
    alt: "Invoices list with status, due dates, totals and remaining balance",
  },
] as const;

type ScreenId = (typeof screens)[number]["id"];

export function CustomerJourneySection() {
  const [active, setActive] = useState<ScreenId>("overview");
  const current = screens.find((screen) => screen.id === active) ?? screens[0];

  return (
    <Section density="tight" className="journey-section relative scroll-mt-24 bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[38%] bottom-0 bg-[linear-gradient(180deg,#ffffff_0%,#f3f6fa_100%)]"
      />

      <Container className="relative">
        <div className="flex flex-col gap-8 lg:gap-10">
          {/* Header */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
            <div className="flex flex-col gap-3">
              <p className="eyebrow text-primary">Your project, on the record</p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.12]">
                From the first question to the final invoice — this is what you’ll see.
              </h2>
            </div>
            <div className="flex flex-col gap-5 lg:items-end">
              <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-[15px] lg:text-right">
                Real screens from Request Service. Check the pro, send a guided request, then
                keep estimates, messages and invoices on one project file — the number you sign
                is the number you’re billed.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/get-a-quote">
                    Request a quote
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/how-it-works">How it works</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Customer dashboard screens"
            className="journey-tabs -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {screens.map((screen) => {
              const Icon = screen.icon;
              const isActive = screen.id === active;
              return (
                <button
                  key={screen.id}
                  type="button"
                  role="tab"
                  id={`journey-tab-${screen.id}`}
                  aria-selected={isActive}
                  aria-controls="journey-panel"
                  onClick={() => setActive(screen.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] duration-300",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(0,63,125,0.8)]"
                      : "border-[#d7e2ef] bg-white text-slate-600 hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {screen.label}
                </button>
              );
            })}
          </div>

          {/* Left details + right screenshot */}
          <div
            id="journey-panel"
            role="tabpanel"
            aria-labelledby={`journey-tab-${current.id}`}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,2.2fr)] lg:gap-10"
          >
            <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:pt-1">
              <p
                key={`${current.id}-title`}
                className="journey-fade text-lg font-semibold tracking-tight text-foreground md:text-xl"
              >
                {current.title}
              </p>
              <p
                key={`${current.id}-body`}
                className="journey-fade text-sm leading-6 text-muted-foreground"
              >
                {current.body}
              </p>
              <ul
                key={`${current.id}-points`}
                className="journey-fade mt-1 flex flex-col gap-2.5"
              >
                {current.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-sm leading-5 text-slate-700"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-black/8 bg-card shadow-[0_30px_70px_-30px_rgba(2,16,36,0.4),0_8px_20px_-12px_rgba(2,16,36,0.22)] ring-1 ring-black/5">
              <div className="flex items-center gap-3 border-b border-black/6 bg-[#f4f6f9] px-3.5 py-2">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                </span>
                <span className="mx-auto hidden h-6 w-full max-w-sm items-center justify-center truncate rounded-md bg-white px-3 font-mono text-[10px] text-muted-foreground ring-1 ring-black/6 sm:flex">
                  {current.url}
                </span>
              </div>
              <Image
                key={current.id}
                src={`${SHOT_DIR}/${current.id}.webp`}
                alt={current.alt}
                width={SHOT.width}
                height={SHOT.height}
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 62vw, 100vw"
                className="journey-fade block h-auto w-full"
                priority
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
