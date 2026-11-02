"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  History,
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
import { BOT_DISCLAIMER, BOT_NAME, BOT_STATUS } from "@/components/bot-ai/systemPromptGuide";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/*
 * Home concept "A" (direct / conversion), built on the site design system.
 * Navy is reserved for the one framing band + closing card; everything else is light.
 * Order: ways to start → RS AI (real widget replica) → proof of control → reviews + stats → closing CTA.
 */

const AI_QUERY = "I need help with a home project.";
const NAVY = "bg-[radial-gradient(120%_120%_at_85%_-10%,rgba(56,189,248,.22),transparent_55%),linear-gradient(160deg,#041a36_0%,#0a2f5e_100%)]";

function StartWithAiButton({ className, size = "lg" }: { className?: string; size?: "lg" | "xl" }) {
  const { openWithQuery } = useBot();

  return (
    <Button size={size} className={cn("shadow-lg shadow-primary/25", className)} onClick={() => openWithQuery(AI_QUERY)}>
      Start with RS AI
      <ArrowRight data-icon="inline-end" />
    </Button>
  );
}

/* ---------- 1. Your home problem has a next step ---------- */

export function NextStepWays() {
  const { openBot } = useBot();
  const ways = [
    { icon: Search, title: "Browse & book services", body: "Pick a category, see local pros, or book a fixed‑price service with a set date.", action: "Browse services", href: "/services" },
    { icon: Users, title: "Visit pro profiles", body: "Explore trusted local businesses, reviews, and past work. Hire directly.", action: "Find a professional", href: "/find-a-professional" },
    { icon: FileText, title: "Request a quote", body: "Tell us about the job. Matching pros send written estimates you can compare.", action: "Get a quote", href: "/get-a-quote" },
    { icon: Sparkles, title: "Ask RS AI", body: "Describe what’s happening. Get answers and the right next step in one chat.", action: "Start a conversation" },
  ] as const;

  return (
    <section className="relative isolate pt-14 pb-10 md:pt-20 md:pb-12">
      <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 -z-10 h-[72%]", NAVY)} />

      <Container className="flex flex-col gap-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-sky-100 backdrop-blur">
            <span className="size-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_2px_rgba(125,211,252,.6)]" />
            Choose how you want to start
          </span>
          <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-[3.4rem] md:leading-[1.02]">
            Your home problem has a <span className="text-sky-200">next step.</span>
          </h2>
          <p className="max-w-xl text-sm leading-7 text-white/75 md:text-base">
            Four ways to move forward — browse, hire directly, request written quotes, or let RS AI guide you. Every path ends with a verified local pro.
          </p>
        </div>

        <ul data-stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ways.map((way, index) => {
            const Icon = way.icon;
            const isAi = !("href" in way);
            const card = cn(
              "group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border bg-background p-6 text-left shadow-[0_30px_60px_-30px_rgba(4,26,54,.55)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_40px_70px_-30px_rgba(4,26,54,.6)]",
              isAi ? "border-emerald-400/50" : "border-white/60",
            );
            const inner = (
              <>
                <div aria-hidden="true" className={cn("absolute -top-16 -right-16 size-40 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100", isAi ? "bg-emerald-400/15 opacity-60" : "bg-primary/10 opacity-0")} />
                <div className="relative flex items-start justify-between">
                  <span className={cn("flex size-11 items-center justify-center rounded-xl ring-1", isAi ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15" : "bg-primary/[0.08] text-primary ring-primary/10")}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {isAi ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold tracking-[.14em] text-emerald-700">RECOMMENDED</span>
                  ) : (
                    <span className="font-mono text-xs font-semibold tracking-[.2em] text-muted-foreground/70">0{index + 1}</span>
                  )}
                </div>
                <h3 className="relative mt-6 text-xl font-semibold tracking-tight text-foreground">{way.title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{way.body}</p>
                <span className={cn("relative mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold", isAi ? "text-emerald-700" : "text-primary")}>
                  {way.action}
                  <span className={cn("flex size-7 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1", isAi ? "bg-emerald-500/10" : "bg-primary/10")}>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </span>
                </span>
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

/* ---------- 2. RS AI — faithful replica of the live widget ---------- */

const SERVICE_CHIPS = ["Plumbing", "HVAC", "Electrical", "Handyman", "House Cleaning"];

function BotPreview() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border-card bg-popover shadow-[0_40px_90px_-40px_rgba(4,26,54,.55)] ring-1 ring-black/5">
      {/* Header — mirrors BotHeader */}
      <div className="flex items-center gap-2.5 border-b bg-linear-to-b from-primary/[0.07] to-transparent px-3 py-2.5">
        <div className="relative">
          <BotAvatar className="size-9" />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative size-3 rounded-full border-2 border-popover bg-emerald-500" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{BOT_NAME}</p>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-500/70" />
            {BOT_STATUS}
          </p>
        </div>
        <div className="flex items-center gap-0.5 text-muted-foreground" aria-hidden="true">
          {[RotateCcw, History, Minus, X].map((Icon, index) => (
            <span key={index} className="flex size-8 items-center justify-center rounded-lg"><Icon className="size-4" /></span>
          ))}
        </div>
      </div>

      {/* Context card — mirrors CapturedContextCard */}
      <div className="flex flex-col gap-1.5 px-3 pt-2.5">
        <div className="flex flex-col gap-2 rounded-xl border bg-card/80 p-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <MapPin className="size-3" aria-hidden="true" />
              Set your address
              <Pencil className="size-2.5 opacity-60" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">Step 1 of 3: <span className="text-foreground">Identifying Service</span></span>
          </div>
          <div className="grid grid-cols-3 gap-1" aria-hidden="true">
            <span className="h-1 rounded-full bg-primary" /><span className="h-1 rounded-full bg-muted" /><span className="h-1 rounded-full bg-muted" />
          </div>
        </div>
        <p className="px-0.5 text-[10px] font-semibold tracking-[.12em] text-muted-foreground">PICK A SERVICE</p>
        <div className="-mx-3 flex gap-1.5 overflow-hidden px-3 [mask-image:linear-gradient(90deg,black_85%,transparent)]">
          {SERVICE_CHIPS.map((chip) => (
            <span key={chip} className="shrink-0 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary">{chip}</span>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex flex-1 flex-col gap-2 px-3 py-3 text-xs leading-5">
        <div className="flex items-end gap-2">
          <BotAvatar className="size-7" />
          <div>
            <div className="max-w-[20rem] rounded-2xl rounded-bl-md border bg-card px-3 py-2 shadow-sm">
              Hi! Welcome to Request Service. Tell me what you need help with and I’ll guide you to the right pro.
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">4:42 AM</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 self-end">
          <div className="max-w-[18rem] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground shadow-md shadow-primary/20">
            There’s a leak under my kitchen sink and the cabinet floor is wet.
          </div>
          <p className="text-[10px] text-muted-foreground">4:43 AM</p>
        </div>
        <div className="flex items-end gap-2">
          <BotAvatar className="size-7" />
          <div className="flex max-w-[20rem] flex-col gap-2">
            <div className="rounded-2xl rounded-bl-md border bg-card px-3 py-2 shadow-sm">
              Got it — that’s a <span className="font-semibold">Plumbing · Leak repair</span> request. I found 3 verified plumbers near you. Book a visit or get written quotes?
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <span className="rounded-lg bg-primary px-3 py-1.5 text-center text-[11px] font-semibold text-primary-foreground">Book a visit</span>
              <span className="rounded-lg border border-primary/25 px-3 py-1.5 text-center text-[11px] font-semibold text-primary">Get quotes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input — mirrors BotInputBar */}
      <div className="border-t bg-popover/95 px-3 pt-2 pb-2">
        <div className="flex items-center gap-1.5 rounded-2xl border bg-background p-1.5 pl-3 shadow-sm">
          <span className="flex-1 text-[13px] text-muted-foreground">Describe your home issue…</span>
          <span className="flex size-8 items-center justify-center rounded-full text-muted-foreground"><Mic className="size-4" aria-hidden="true" /></span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25"><ArrowUp className="size-4" aria-hidden="true" /></span>
        </div>
        <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">{BOT_DISCLAIMER}</p>
      </div>
    </div>
  );
}

export function RsAiShowcase() {
  const points = [
    { icon: Clock3, text: "From first message to a booked pro in minutes" },
    { icon: BadgeCheck, text: "Only verified local businesses are suggested" },
    { icon: FileText, text: "Book a visit, or get written quotes to compare" },
  ] as const;

  return (
    <section className="relative overflow-hidden py-10 md:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-20 size-[36rem] rounded-full bg-primary/[0.07] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-0 size-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
      <Container className="grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[linear-gradient(135deg,rgba(0,63,125,.10),rgba(16,185,129,.10))]" />
          <BotPreview />
          <div className="absolute -right-4 -bottom-5 hidden items-center gap-3 rounded-2xl border border-border-card bg-background p-3.5 pr-5 shadow-xl sm:flex">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="size-5" aria-hidden="true" /></span>
            <span className="text-xs leading-tight">
              <span className="block font-semibold text-foreground">Request organized</span>
              <span className="text-muted-foreground">3 pros notified · replies within the hour</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <p className="eyebrow text-primary">RS AI Assistant · Live on every page</p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-[3.1rem] md:leading-[1.04]">
            Tell RS what happened. <span className="text-emerald-600">It handles the booking.</span>
          </h2>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            No calls. No back‑and‑forth. RS AI identifies the service, finds verified pros in your area, and books the visit or collects written quotes — all in one conversation.
          </p>
          <ul className="flex flex-col gap-3">
            {points.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.text} className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                  {point.text}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <StartWithAiButton size="xl" />
            <Link href="/how-it-works" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              See how it works <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- 3. Proof of control ---------- */

export function ProofOfControl() {
  const estimateRows = [
    ["Written estimate", true, true],
    ["Scope included", true, true],
    ["Earliest visit", "Tomorrow", "Thursday"],
    ["Total price", "$1,250", "$1,320"],
  ] as const;
  const pros = ["EH", "HC", "BP"];
  const checks = ["Background‑checked", "Licensed & insured", "Rated by homeowners"];
  const timeline = [
    ["Inspect", "Tue 9:00 AM", "done"],
    ["Estimate", "Same day", "done"],
    ["Schedule", "You pick", "current"],
    ["Complete", "Verified", "next"],
  ] as const;

  return (
    <section className="py-16 md:py-24">
      <Container className="flex flex-col gap-12 md:gap-16">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow text-emerald-700">Proof of control</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.06]">
              You stay in control. <span className="text-primary">Every step.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground md:text-right">
            Real numbers, real people, and a schedule you can see — nothing happens without your approval.
          </p>
        </div>

        <div data-stagger className="grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border-card/70">
          {/* 1 — estimates */}
          <div className="flex flex-col gap-5 md:pr-10">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-primary/10"><FileText className="size-5" aria-hidden="true" /></span>
              <h3 className="text-base font-semibold tracking-tight">Compare written estimates</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Side‑by‑side quotes, scope, and pricing — all in one place.</p>
            <div className="text-xs">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] pb-2 font-semibold text-muted-foreground">
                <span />
                <span className="text-emerald-700">Pro B</span>
                <span>Pro C</span>
              </div>
              {estimateRows.map(([label, b, c]) => (
                <div key={label} className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-t border-border-card/70 py-2.5">
                  <span className="font-medium text-foreground">{label}</span>
                  {[b, c].map((value, index) => (
                    <span key={index} className={cn("font-semibold", index === 0 ? "text-emerald-700" : "text-foreground")}>
                      {value === true ? <Check className="size-3.5 text-emerald-600" aria-label="Included" /> : value}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BadgeCheck className="size-3.5 text-emerald-600" aria-hidden="true" /> Best value highlighted. You choose.</p>
          </div>

          {/* 2 — verified pros */}
          <div className="flex flex-col gap-5 md:px-10">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-primary/10"><ShieldCheck className="size-5" aria-hidden="true" /></span>
              <h3 className="text-base font-semibold tracking-tight">Verified local pros</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Every business is reviewed before it can respond to your request.</p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2.5">
                {pros.map((initials) => (
                  <span key={initials} className="flex size-10 items-center justify-center rounded-full border-2 border-background bg-primary/[0.08] text-[11px] font-bold text-primary">{initials}</span>
                ))}
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-background bg-emerald-500 text-white"><Check className="size-4" aria-hidden="true" /></span>
              </div>
              <span className="text-xs leading-tight">
                <span className="block font-semibold text-foreground">3 verified pros matched</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" /> 4.9 average · 297 reviews</span>
              </span>
            </div>
            <ul className="flex flex-col divide-y divide-border-card/70 text-sm">
              {checks.map((check) => (
                <li key={check} className="flex items-center gap-2.5 py-2.5 text-foreground">
                  <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  {check}
                </li>
              ))}
            </ul>
          </div>

          {/* 3 — timeline */}
          <div className="flex flex-col gap-5 md:pl-10">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-primary/10"><CalendarDays className="size-5" aria-hidden="true" /></span>
              <h3 className="text-base font-semibold tracking-tight">Clear project timeline</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Know what happens when. No surprises.</p>
            <ol className="relative mt-2 grid grid-cols-4">
              <span aria-hidden="true" className="absolute top-3 right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-border-card/80" />
              <span aria-hidden="true" className="absolute top-3 left-[12.5%] h-0.5 w-[50%] rounded-full bg-emerald-500" />
              {timeline.map(([step, when, state], index) => (
                <li key={step} className="relative flex flex-col items-center gap-2 text-center">
                  <span className={cn("flex size-6 items-center justify-center rounded-full text-[10px] font-bold", state === "done" && "bg-emerald-500 text-white", state === "current" && "bg-primary text-white ring-4 ring-primary/15", state === "next" && "border-2 border-border-card bg-background text-muted-foreground")}>
                    {state === "done" ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="text-[11px] leading-tight">
                    <span className={cn("block font-semibold", state === "next" ? "text-muted-foreground" : "text-foreground")}>{step}</span>
                    <span className="text-muted-foreground">{when}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5 text-primary" aria-hidden="true" /> Live updates in your project file.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- 4. Reviews carousel + stats ---------- */

const REVIEWS = [
  { quote: "Request Service made a stressful home issue simple. I felt informed and in control the whole time.", name: "Sarah M.", meta: "Homeowner · Kitchen leak repair", initials: "SM" },
  { quote: "Three written estimates by the next morning. I picked the one that fit and the job was done on Friday.", name: "Daniel R.", meta: "Homeowner · Water heater replacement", initials: "DR" },
  { quote: "I described the problem to RS AI, added a photo, and had an inspection booked before lunch.", name: "Priya K.", meta: "Homeowner · Ceiling water damage", initials: "PK" },
  { quote: "Knowing exactly when the pro arrived and what was finished each day took all the guesswork out.", name: "Marcus T.", meta: "Homeowner · Bathroom remodel", initials: "MT" },
];

export function TrustStrip() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const review = REVIEWS[index];
  const go = (step: number) => setIndex((current) => (current + step + REVIEWS.length) % REVIEWS.length);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => go(1), 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const stats = [
    { value: "4.8", suffix: "/5", label: "Homeowner rating", note: "From 2,000+ verified reviews", stars: true },
    { value: "95", suffix: "%", label: "Booking completion", note: "Jobs booked end‑to‑end" },
    { value: "Local", suffix: " first", label: "Always local pros", note: "Never outsourced" },
  ] as const;

  return (
    <section className="py-14 md:py-20">
      <Container className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <figure
          className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-border-card bg-[linear-gradient(135deg,#f7fafd_0%,#eaf2fb_100%)] p-8 shadow-[0_30px_70px_-45px_rgba(4,26,54,.45)] md:p-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <Quote aria-hidden="true" className="absolute -top-4 right-6 size-32 text-primary/[0.06]" />
          <p className="eyebrow text-primary">What homeowners say</p>
          <div key={index} className="reveal-list mt-6 flex flex-col gap-6">
            <blockquote className="text-balance text-xl font-medium leading-relaxed text-foreground md:text-[1.6rem] md:leading-snug">
              “{review.quote}”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-[#0a4f9a] text-sm font-bold text-white shadow-md shadow-primary/25">{review.initials}</span>
              <span className="text-sm">
                <span className="block font-semibold text-foreground">{review.name}</span>
                <span className="text-muted-foreground">{review.meta}</span>
              </span>
              <span className="ml-auto flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, star) => <Star key={star} className="size-4 fill-current" aria-hidden="true" />)}
              </span>
            </figcaption>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-1.5" role="tablist" aria-label="Choose review">
              {REVIEWS.map((item, dot) => (
                <button key={item.name} type="button" role="tab" aria-selected={dot === index} aria-label={`Review ${dot + 1}`} onClick={() => setIndex(dot)} className={cn("h-1.5 rounded-full transition-all", dot === index ? "w-8 bg-primary" : "w-3 bg-primary/20 hover:bg-primary/40")} />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => go(-1)} aria-label="Previous review" className="flex size-10 items-center justify-center rounded-full border border-border-card bg-background text-foreground shadow-sm transition hover:border-primary hover:text-primary"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label="Next review" className="flex size-10 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/25 transition hover:scale-105"><ChevronRight className="size-5" /></button>
            </div>
          </div>
        </figure>

        <dl className="grid content-center gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-5 rounded-2xl border border-border-card bg-background px-6 py-5 shadow-[0_20px_50px_-40px_rgba(4,26,54,.5)]">
              <dd className="min-w-[7.5rem] text-4xl font-semibold tracking-tight text-foreground">
                {stat.value}<span className="text-xl text-muted-foreground">{stat.suffix}</span>
              </dd>
              <div className="min-w-0 flex-1">
                <dt className="text-sm font-semibold text-foreground">{stat.label}</dt>
                <p className="text-xs text-muted-foreground">{stat.note}</p>
              </div>
              {"stars" in stat ? (
                <span className="hidden gap-0.5 text-amber-400 sm:flex" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, star) => <Star key={star} className="size-3.5 fill-current" />)}
                </span>
              ) : (
                <span className="hidden size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 sm:flex"><Check className="size-4" aria-hidden="true" /></span>
              )}
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ---------- 5. Closing CTA ---------- */

export function ReadyToSolve() {
  return (
    <section className="pb-14 md:pb-20">
      <Container>
        <div className={cn("relative overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-[0_40px_90px_-45px_rgba(4,26,54,.8)] md:px-14 md:py-14", NAVY)}>
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-6 -top-10 size-72 rounded-full border border-white/10" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.6rem] md:leading-[1.05]">Ready to solve it?</h2>
              <p className="mt-2 text-sm leading-7 text-white/75 md:text-base">From first message to finished job. We make it simple.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <StartWithAiButton size="xl" className="bg-white text-[#041a36] shadow-black/20 hover:bg-white/90" />
              <Button size="xl" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/services">Browse services<ArrowRight data-icon="inline-end" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
