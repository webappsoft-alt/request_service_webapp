"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Home,
  Leaf,
  MapPin,
  Mic,
  Minus,
  Pencil,
  Quote,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { useBot } from "@/components/bot-ai";
import { BotAvatar } from "@/components/bot-ai/BotHeader";
import { BOT_NAME, BOT_STATUS } from "@/components/bot-ai/systemPromptGuide";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/*
 * Home concept "A" — a 1:1 build of the approved reference board.
 * Palette: navy #0B2A4F, green #178A4C, hairline #D5DFEB, tint #E8F0FA, band #F3F6F9.
 * Headlines are serif; spacing is deliberately tight so the five bands read as one board.
 */

const NAVY = "#0B2A4F";
const GREEN = "#178A4C";
const AI_QUERY = "I need help with a home project.";

function StartWithAiButton({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const { openWithQuery } = useBot();

  return (
    <Button
      size="lg"
      className={cn(
        "rounded-lg px-5",
        tone === "light" ? "bg-white text-[#0B2A4F] hover:bg-white/90" : "bg-[#0B2A4F] text-white hover:bg-[#0B2A4F]/90",
        className,
      )}
      onClick={() => openWithQuery(AI_QUERY)}
    >
      Start with RS AI
      <ArrowUpRight data-icon="inline-end" />
    </Button>
  );
}

/* ---------- 1. Navy band — three ways to move forward ---------- */

export function NextStepWays() {
  const { openBot } = useBot();
  const ways = [
    { icon: Search, title: "Browse services", body: "Explore trusted pros by service, availability, and reviews.", href: "/services" },
    { icon: Sparkles, title: "Ask RS AI", body: "Describe what’s happening. Get answers and next steps." },
    { icon: Users, title: "Get matched", body: "Tell us about the job. We’ll match you with the right pros.", href: "/get-a-quote" },
  ] as const;

  return (
    <section className="py-9 text-white md:py-10" style={{ backgroundColor: NAVY }}>
      <Container className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-tight">Your home problem has a next step.</h2>
          <p className="mt-1.5 text-sm text-white/75">Three ways to move forward. Choose what feels right.</p>
        </div>

        <ul data-stagger className="grid gap-4 md:grid-cols-3">
          {ways.map((way) => {
            const Icon = way.icon;
            const isAi = !("href" in way);
            const card = "group flex h-full w-full items-center gap-4 rounded-lg border border-[#D5DFEB] bg-white px-5 py-4 text-left text-[#0B2A4F] transition-colors hover:border-[#0B2A4F]/40";
            const inner = (
              <>
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", isAi ? "bg-[#178A4C] text-white" : "bg-[#E8F0FA] text-[#0B2A4F]")}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[17px] font-semibold leading-tight tracking-tight">{way.title}</span>
                  <span className="mt-1 text-[13px] leading-5 text-slate-600">{way.body}</span>
                </span>
                <ArrowRight className="size-5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </>
            );
            return (
              <li key={way.title} className="flex">
                {"href" in way ? <Link href={way.href} className={card}>{inner}</Link> : <button type="button" onClick={openBot} className={card}>{inner}</button>}
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

/* ---------- 2. Light-blue panel — Chat with RS AI ---------- */

const SERVICE_CHIPS = ["Plumbing", "HVAC", "Electrical", "Handyman", "House Cleaning"];

/** Compact replica of the live RS AI widget (BotHeader, CapturedContextCard, BotInputBar). */
function ChatCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#D5DFEB] bg-popover text-[11px] leading-4 shadow-[0_8px_24px_-18px_rgba(11,42,79,.45)]">
      <div className="flex items-center gap-2 border-b bg-linear-to-b from-primary/[0.07] to-transparent px-3 py-2">
        <div className="relative">
          <BotAvatar className="size-7" />
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-popover bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] leading-tight font-semibold">{BOT_NAME}</p>
          <p className="flex items-center gap-1 whitespace-nowrap text-[10px] font-medium text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-500/70" />
            {BOT_STATUS}
          </p>
        </div>
        <div className="flex items-center gap-0.5 text-muted-foreground" aria-hidden="true">
          {[RotateCcw, History, Minus, X].map((Icon, index) => (
            <span key={index} className="flex size-6 items-center justify-center rounded-md"><Icon className="size-3.5" /></span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pt-2">
        <div className="flex items-center gap-2 rounded-lg border bg-card/80 px-2 py-1.5 shadow-sm">
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <MapPin className="size-3" aria-hidden="true" />
            Set your address
            <Pencil className="size-2.5 opacity-60" aria-hidden="true" />
          </span>
          <span className="grid flex-1 grid-cols-3 gap-1" aria-hidden="true">
            <span className="h-1 rounded-full bg-primary" /><span className="h-1 rounded-full bg-muted" /><span className="h-1 rounded-full bg-muted" />
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">Step 1 of 3</span>
        </div>
        <div className="-mx-3 flex gap-1.5 overflow-hidden px-3 [mask-image:linear-gradient(90deg,black_88%,transparent)]">
          {SERVICE_CHIPS.map((chip) => (
            <span key={chip} className="shrink-0 rounded-full border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-semibold text-primary">{chip}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-3 py-2">
        <div className="flex items-end gap-1.5">
          <BotAvatar className="size-5" />
          <div className="max-w-[85%] rounded-xl rounded-bl-sm border bg-card px-2.5 py-1.5 shadow-sm">
            Hi! Welcome to Request Service. Tell me what you need help with and I’ll guide you to the right pro.
          </div>
        </div>
        <div className="max-w-[80%] self-end rounded-xl rounded-br-sm bg-primary px-2.5 py-1.5 text-primary-foreground shadow-md shadow-primary/20">
          There’s a leak under my kitchen sink and the cabinet floor is wet.
        </div>
        <div className="flex items-end gap-1.5">
          <BotAvatar className="size-5" />
          <div className="flex max-w-[85%] flex-wrap items-center gap-1.5">
            <span className="rounded-xl rounded-bl-sm border bg-card px-2.5 py-1.5 shadow-sm">
              Got it — <span className="font-semibold">Plumbing · Leak repair</span>. 3 verified plumbers near you.
            </span>
            <span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">Book a visit</span>
            <span className="rounded-md border border-primary/25 px-2.5 py-1 text-[10px] font-semibold text-primary">Get quotes</span>
          </div>
        </div>
      </div>

      <div className="border-t px-3 py-2">
        <div className="flex items-center gap-1 rounded-xl border bg-background p-1 pl-2.5 shadow-sm">
          <span className="flex-1 text-[11px] text-muted-foreground">Describe your home issue…</span>
          <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground"><Mic className="size-3.5" aria-hidden="true" /></span>
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25"><ArrowUp className="size-3.5" aria-hidden="true" /></span>
        </div>
      </div>
    </div>
  );
}

/** Fades the photo into the panel: same curve on the left and right, a softer one at the top and bottom edges. */
const IMAGE_MASK =
  "linear-gradient(90deg, transparent 0%, black 38%, black 62%, transparent 100%), linear-gradient(180deg, transparent 0%, black 14%, black 90%, transparent 100%)";

export function RsAiShowcase() {
  return (
    <section className="py-5 md:py-6">
      <Container>
        <div className="relative grid items-center gap-5 overflow-hidden rounded-2xl border border-[#D5DFEB] bg-[linear-gradient(100deg,#ffffff_0%,#eef4fb_48%,#d9e6f4_100%)] p-4 md:p-5 lg:grid-cols-[1.1fr_1.2fr_.9fr] lg:gap-4">
          <ChatCard />
          <div
            role="img"
            aria-label="A plumber repairing the pipe under a kitchen sink"
            className="hidden h-[calc(100%+2rem)] min-h-[200px] w-full -my-4 bg-cover bg-[center_25%] md:-my-5 md:h-[calc(100%+2.5rem)] lg:block"
            style={{
              backgroundImage: "url('/images/home/rs-ai-kitchen-repair.jpg')",
              maskImage: IMAGE_MASK,
              WebkitMaskImage: IMAGE_MASK,
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          <div className="flex flex-col gap-3 lg:pl-2">
            <p className="text-[11px] font-semibold tracking-[.18em] text-slate-600">RS AI ASSISTANT</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-[#0B2A4F] lg:text-[1.8rem] xl:text-[2rem]">
              Tell RS what happened. <span style={{ color: GREEN }}>It handles the booking.</span>
            </h2>
            <p className="text-sm leading-6 text-slate-700">No calls. No back‑and‑forth.<br />Just a clear next step.</p>
            <div className="mt-1"><StartWithAiButton /></div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- 3. White band — proof of control ---------- */

const TIMELINE_STEPS = [{ label: "Inspect" }, { label: "Estimate" }, { label: "Schedule" }, { label: "Complete" }];

/** Looping stepper: each step checks itself off in turn, then the cycle restarts. */
function AnimatedTimeline() {
  const [done, setDone] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setReduced(true);
      setDone(TIMELINE_STEPS.length);
    }
  }, []);

  useEffect(() => {
    if (reduced) return;
    const total = TIMELINE_STEPS.length;
    const delay = done >= total ? 2600 : done === 0 ? 700 : 1100;
    const timer = setTimeout(() => setDone((value) => (value >= total ? 0 : value + 1)), delay);
    return () => clearTimeout(timer);
  }, [done, reduced]);

  return (
    <div className="pt-1">
      <ol className="grid grid-cols-4">
        {TIMELINE_STEPS.map((step, index) => {
          const checked = index < done;
          const active = index === done;
          const last = index === TIMELINE_STEPS.length - 1;
          return (
            <li key={step.label} className="relative flex flex-col items-center gap-2 text-center">
              {!last ? (
                <span aria-hidden="true" className="absolute top-[11px] left-1/2 h-0.5 w-full overflow-hidden rounded-full bg-[#D5DFEB]">
                  <span
                    className="block h-full origin-left transition-transform duration-700 ease-out"
                    style={{ backgroundColor: GREEN, transform: index < done - 1 ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </span>
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-white transition-all duration-500",
                  checked ? "border-transparent text-white" : active ? "border-[#0B2A4F] shadow-[0_0_0_4px_rgba(11,42,79,.12)]" : "border-[#C9D5E3]",
                )}
                style={checked ? { backgroundColor: GREEN, borderColor: GREEN } : undefined}
              >
                <Check
                  className="size-3.5 transition-all duration-300"
                  strokeWidth={3}
                  style={{ opacity: checked ? 1 : 0, transform: checked ? "scale(1)" : "scale(.4)" }}
                  aria-hidden="true"
                />
              </span>
              <span className={cn("text-[10px] font-medium tracking-tight transition-colors", checked ? "text-[#0B2A4F]" : "text-slate-500")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ESTIMATE_ROWS = [
  { label: "Written estimate", b: "$1,250", c: "$1,250" },
  { label: "Scope included", b: "check", c: "check" },
  { label: "Total price", b: "$1,475", c: "$1,320", total: true },
] as const;

const ESTIMATE_GRID = "grid grid-cols-[1fr_2.9rem_2.9rem] items-center gap-x-1";

/** Compact side-by-side quote table, as on the reference board. */
function EstimateCompare() {
  const cell = (text: string, highlight?: boolean) =>
    text === "check" ? (
      <Check className="mx-auto size-3.5" strokeWidth={2.5} style={{ color: GREEN }} aria-label="Included" />
    ) : (
      <span className={cn("block text-center", highlight && "font-bold")} style={highlight ? { color: GREEN } : undefined}>{text}</span>
    );

  return (
    <div className="text-[11px] text-slate-800">
      <div className={cn(ESTIMATE_GRID, "pb-1 text-[10px] font-semibold text-slate-500")}>
        <span /><span className="text-center">Pro B</span><span className="text-center">Pro C</span>
      </div>
      {ESTIMATE_ROWS.map((row) => (
        <div key={row.label} className={cn(ESTIMATE_GRID, "border-t border-[#E3EAF2] py-1.5", "total" in row && "font-semibold text-[#0B2A4F]")}>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Check className="size-3" strokeWidth={3} style={{ color: GREEN }} aria-hidden="true" />{row.label}
          </span>
          {cell(row.b)}
          {cell(row.c, "total" in row)}
        </div>
      ))}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-3 py-1.5 text-[10px] font-bold tracking-[.12em]" style={{ borderColor: GREEN, color: GREEN }}>
      VERIFIED LOCAL PRO
      <span className="flex size-4 items-center justify-center rounded-full text-white" style={{ backgroundColor: GREEN }}><Check className="size-3" strokeWidth={3} aria-hidden="true" /></span>
    </span>
  );
}

export function ProofOfControl() {
  const proofs = [
    { icon: FileText, title: "Compare written estimates", body: "Side‑by‑side quotes, scope, and pricing. All in one place.", demo: <EstimateCompare /> },
    { icon: ShieldCheck, title: "Verified local pros", body: "Background‑checked. Licensed. Insured. Rated by homeowners.", demo: <VerifiedBadge /> },
    { icon: CalendarDays, title: "Clear project timeline", body: "Know what happens when. No surprises.", demo: <AnimatedTimeline /> },
  ];

  return (
    <section className="border-y border-[#E3EAF2] bg-white py-6 md:py-7">
      <Container className="grid items-center gap-6 lg:grid-cols-[.65fr_3.35fr] lg:gap-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[.18em]" style={{ color: GREEN }}>PROOF OF CONTROL</p>
          <h2 className="mt-1.5 font-serif text-2xl font-semibold leading-tight tracking-tight text-[#0B2A4F] md:text-[1.6rem]">You stay in control.<br />Every step.</h2>
        </div>

        <div data-stagger className="grid gap-6 md:grid-cols-3 md:gap-0">
          {proofs.map(({ icon: Icon, title, body, demo }) => (
            <div
              key={title}
              className="relative flex flex-col justify-center gap-3 md:px-6 md:first:pl-0 md:last:pr-0 md:not-first:before:absolute md:not-first:before:top-1/2 md:not-first:before:left-0 md:not-first:before:h-20 md:not-first:before:w-px md:not-first:before:-translate-y-1/2 md:not-first:before:bg-[#D5DFEB]"
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-7 shrink-0 text-[#0B2A4F]" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <h3 className="text-[14px] font-semibold leading-tight text-[#0B2A4F]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{body}</p>
                </div>
              </div>
              <div>{demo}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------- 4. Grey band — testimonial + stats ---------- */

const REVIEWS = [
  { quote: "Request Service made a stressful home issue simple. I felt informed and in control the whole time.", name: "Sarah M.", initials: "SM" },
  { quote: "Three written estimates by the next morning. I picked the one that fit and the job was done on Friday.", name: "Daniel R.", initials: "DR" },
  { quote: "I described the problem to RS AI, added a photo, and had an inspection booked before lunch.", name: "Priya K.", initials: "PK" },
];

export function TrustStrip() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const review = REVIEWS[index];
  const go = (step: number) => setIndex((current) => (current + step + REVIEWS.length) % REVIEWS.length);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => go(1), 7000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const stats = [
    { icon: ShieldCheck, value: "4.8/5", label: "Homeowner Rating", note: "From 2,000+ reviews" },
    { icon: Home, value: "95%", label: "Booking Completion Rate", note: "Jobs booked end‑to‑end" },
    { icon: Leaf, value: "Local First", label: "Always local pros", note: "Never outsourced" },
  ] as const;

  return (
    <section className="border-y border-[#E3EAF2] bg-[#F3F6F9] py-6 md:py-7">
      <Container className="grid items-center gap-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-0">
        <figure className="flex gap-3 lg:pr-8" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <Quote className="size-6 shrink-0 fill-current" style={{ color: GREEN }} aria-hidden="true" />
          <div key={index} className="reveal-list flex min-w-0 flex-1 flex-col gap-3">
            <blockquote className="font-serif text-[15px] italic leading-6 text-slate-800">{review.quote}</blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#E8F0FA] text-xs font-bold text-[#0B2A4F]">{review.initials}</span>
              <span className="text-xs leading-tight">
                <span className="block font-semibold text-slate-900">— {review.name}</span>
                <span className="text-slate-500">Homeowner</span>
              </span>
              <span className="ml-1 flex gap-0.5" style={{ color: GREEN }} aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, star) => <Star key={star} className="size-3 fill-current" aria-hidden="true" />)}
              </span>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => go(-1)} aria-label="Previous review" className="flex size-6 items-center justify-center rounded-full border border-[#D5DFEB] bg-white text-slate-600 hover:text-[#0B2A4F]"><ChevronLeft className="size-3.5" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next review" className="flex size-6 items-center justify-center rounded-full border border-[#D5DFEB] bg-white text-slate-600 hover:text-[#0B2A4F]"><ChevronRight className="size-3.5" /></button>
              </span>
            </figcaption>
          </div>
        </figure>

        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="relative flex items-center gap-3 lg:px-8 lg:before:absolute lg:before:top-1/2 lg:before:left-0 lg:before:h-14 lg:before:w-px lg:before:-translate-y-1/2 lg:before:bg-[#D5DFEB]"
            >
              <Icon className="size-7 shrink-0 text-[#0B2A4F]" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <p className="whitespace-nowrap font-serif text-xl font-semibold leading-tight text-[#0B2A4F]">{stat.value}</p>
                <p className="whitespace-nowrap text-xs font-semibold text-slate-800">{stat.label}</p>
                <p className="whitespace-nowrap text-[11px] text-slate-500">{stat.note}</p>
              </div>
            </div>
          );
        })}
      </Container>
    </section>
  );
}

/* ---------- 5. White band — closing CTA ---------- */

export function ReadyToSolve() {
  return (
    <section className="py-9 text-white md:py-11" style={{ backgroundColor: NAVY }}>
      <Container className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight md:text-[1.9rem]">Ready to solve it?</h2>
          <p className="mt-1 text-sm text-white/75">From first message to finished job. We make it simple.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StartWithAiButton tone="light" />
          <Button size="lg" variant="outline" className="rounded-lg border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
            <Link href="/services">Browse Services<ArrowRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
