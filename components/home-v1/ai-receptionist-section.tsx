"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, PhoneCall, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/** What the receptionist really does on a call (see the backend ai-calling intake flow). */
const FLOW = [
  {
    title: "Answers in the pro's name, any hour",
    body: "Every Pro with the AI Receptionist gets a dedicated number. Nights, weekends, mid-job — the call is picked up.",
  },
  {
    title: "Captures the job details",
    body: "It asks what's going on, then takes the caller's name, phone, address, and email — and checks the job fits the pro's services and area.",
  },
  {
    title: "Books the visit or drafts the estimate",
    body: "A site visit goes straight onto the pro's calendar within their working hours, or a draft estimate is saved for review.",
  },
  {
    title: "The pro reviews and follows up",
    body: "Nothing is sent to the caller without the pro. Ask for a person and the call is transferred.",
  },
] as const;

type Line = { who: "ai" | "caller"; text: string };

/** A sample conversation (illustrative — not a recording of a real customer). */
const SAMPLE: Line[] = [
  { who: "ai", text: "Thanks for calling Oakline Plumbing, this is the virtual assistant. How can I help?" },
  { who: "caller", text: "Hi — water's leaking under my kitchen sink and it won't stop." },
  { who: "ai", text: "Sorry to hear that. Is the leak coming from the pipes or the faucet, and have you shut off the valve?" },
  { who: "caller", text: "From the pipe, I think. Yes, the valve is off now." },
  { who: "ai", text: "Good. Can I get your name and the service address?" },
  { who: "caller", text: "Maria Lopez, 214 Palm Avenue, Tampa." },
  { who: "ai", text: "Thanks, Maria. I can book a technician tomorrow between 9 and 11 AM. Does that work?" },
  { who: "caller", text: "That's perfect." },
  { who: "ai", text: "You're booked. The team will confirm shortly — anything else I can help with?" },
];

/** Time each line "speaks" for, from its length (a little faster than real speech). */
const lineMs = (line: Line) => Math.min(4200, 900 + line.text.length * 32);
/** How long the finished call stays on screen before it starts over. */
const LOOP_PAUSE_MS = 3500;
const BARS = 28;

function Waveform({ active, tone }: { active: boolean; tone: "ai" | "caller" }) {
  return (
    <div aria-hidden="true" className="flex h-10 items-center gap-[3px]">
      {Array.from({ length: BARS }, (_, index) => (
        <span
          key={index}
          className={cn(
            "w-[3px] rounded-full transition-colors duration-300",
            tone === "ai" ? "bg-sky-300" : "bg-white/70",
            active ? "rs-wave" : "opacity-40",
          )}
          style={{
            height: active ? undefined : `${18 + ((index * 37) % 50)}%`,
            animationDelay: `${(index % 7) * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * "AI Receptionist & 24/7 call dispatch" (home-v1): the real call flow as a numbered rail on the
 * left, a sample call on the right (transcript + voice waveform) that plays by itself while the
 * panel is on screen and loops. A small pause button stops it; reduced motion shows it static.
 */
export function AiReceptionistSection() {
  const [shown, setShown] = useState(0); // lines revealed
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const finished = shown >= SAMPLE.length;
  const playing = inView && !paused && !reducedMotion;
  const speaking = playing && !finished ? SAMPLE[shown] : null;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
      setShown(SAMPLE.length);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  // Next line, or — once the call is over — a short pause and start again.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => setShown((count) => (count >= SAMPLE.length ? 0 : count + 1)),
      finished ? LOOP_PAUSE_MS : lineMs(SAMPLE[shown]),
    );
    return () => window.clearTimeout(timer);
  }, [playing, shown, finished]);

  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTo({ top: shown ? box.scrollHeight : 0, behavior: "smooth" });
  }, [shown]);
  // The line being spoken shows right away (typing in the waveform), the rest stay hidden.
  const visible = SAMPLE.slice(0, speaking ? shown + 1 : shown);

  return (
    <Section className="bg-background">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p className="inline-flex w-fit items-center gap-2 eyebrow text-primary">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              AI Receptionist · 24/7
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Call anytime. A real answer, every time.
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Homeowners can call a Request Service pro day or night. Their AI receptionist picks up instantly,
              captures the project details, and books the next step — so no job waits for a call-back.
            </p>
          </div>

          <ol className="relative flex flex-col gap-6">
            <span aria-hidden="true" className="absolute top-3 bottom-3 left-[0.9rem] w-px bg-border" />
            {FLOW.map((step, index) => (
              <li key={step.title} className="relative flex gap-4">
                <span className="relative z-10 flex size-[1.85rem] shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background font-mono text-[11px] font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[15px] font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link href="/find-a-professional">
                Find a pro to call
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Sample call */}
        <div ref={panelRef} className="min-w-0">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#071a33] p-5 text-white shadow-[0_40px_80px_-40px_rgba(7,26,51,0.65)] sm:p-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.25),transparent_65%)]"
            />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <PhoneCall className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">AI Receptionist</p>
                  <p className="truncate text-xs text-white/60">
                    {finished ? "Call ended · visit booked" : playing ? "On a call · live transcript" : "Sample call"}
                  </p>
                </div>
              </div>
              {reducedMotion ? null : (
                <button
                  type="button"
                  onClick={() => setPaused((value) => !value)}
                  aria-label={paused ? "Play the sample call" : "Pause the sample call"}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
                >
                  {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                </button>
              )}
            </div>

            <div className="relative mt-5 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2">
              <span className="w-16 shrink-0 text-[11px] font-medium tracking-wide text-white/60 uppercase">
                {speaking ? (speaking.who === "ai" ? "AI" : "Caller") : "Idle"}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <Waveform active={Boolean(speaking)} tone={speaking?.who ?? "ai"} />
              </div>
            </div>

            <div
              ref={scrollRef}
              aria-live="polite"
              className="relative mt-5 flex h-[19rem] flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:none]"
            >
              {!visible.length ? (
                <p className="m-auto max-w-[16rem] text-center text-sm leading-6 text-white/55">
                  Incoming call…
                </p>
              ) : (
                visible.map((line, index) => (
                  <p
                    key={index}
                    className={cn(
                      "animate-in fade-in slide-in-from-bottom-1 max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 duration-300",
                      line.who === "ai"
                        ? "self-start rounded-tl-md bg-sky-400/15 text-sky-50"
                        : "self-end rounded-tr-md bg-white/10 text-white",
                    )}
                  >
                    {line.text}
                  </p>
                ))
              )}
            </div>

            <p className="relative mt-5 border-t border-white/10 pt-4 text-[11px] leading-5 text-white/45">
              Illustrative sample. On a real call the pro receives the details, the booked visit, and the transcript
              in their portal.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
