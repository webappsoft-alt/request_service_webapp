"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Home, MapPin, ShieldCheck } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/** The updates a homeowner gets on a booked job (order flow + project stages), in order. */
const EVENTS = [
  { label: "Pro is on the way", detail: "En route to your address", time: "9:12 AM" },
  { label: "Arrived on site", detail: "Verified · 48 m from the door", time: "9:41 AM" },
  { label: "Work started", detail: "Crew clocked in at the site", time: "9:45 AM" },
  { label: "Stage completed", detail: "Diagnostics done · next: Repair", time: "11:20 AM" },
  { label: "Job completed", detail: "Ready for your review", time: "1:05 PM" },
] as const;

/** Where the pro's marker sits on the illustrated map for each step (SVG units, 320×220). */
const MARKER = [
  { x: 34, y: 186 },
  { x: 166, y: 128 },
  { x: 198, y: 112 },
  { x: 198, y: 112 },
  { x: 198, y: 112 },
];
const STEP_MS = 2400;
const LOOP_PAUSE_MS = 3200;

const POINTS = [
  { title: "Arrival you can trust", body: "A pro can only mark “arrived” from within 200 m of your address — checked by their phone's location." },
  { title: "Time that matches the work", body: "Crews clock in and out only at the site, and are clocked out automatically if they leave it." },
  { title: "Every stage, as it happens", body: "Stage updates and crew notes land in your project timeline, with a notification at each step." },
] as const;

/**
 * "Geofenced time tracking & real-time job updates" (home-v1): an illustrated map (pro marker
 * entering the 200 m site radius) beside the job's update timeline, played on a loop while on
 * screen; copy on the other side. Illustrative — homeowners get the updates, not a live map.
 */
export function GeofenceTrackingSection({ tone = "default" }: { tone?: "default" | "clean" }) {
  const clean = tone === "clean";
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducedMotion(true);
      setStep(EVENTS.length - 1);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const last = step >= EVENTS.length - 1;
    const timer = window.setTimeout(() => setStep(last ? 0 : step + 1), last ? LOOP_PAUSE_MS : STEP_MS);
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion, step]);

  const arrived = step >= 1;
  const marker = MARKER[step];

  return (
    <Section density={clean ? "tight" : "default"} className={clean ? undefined : "bg-muted/50"}>
      <Container className={cn("grid items-center lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]", clean ? "gap-8 lg:gap-12" : "gap-12 lg:gap-16")}>
        {/* Illustration (left on desktop, below the copy on phones) */}
        <div ref={panelRef} className="order-2 min-w-0 lg:order-1">
          <div
            className={cn(
              "overflow-hidden bg-background",
              clean
                ? "rounded-2xl shadow-[0_24px_60px_-32px_rgba(11,42,79,0.35),0_0_0_1px_rgba(11,42,79,0.06)]"
                : "rounded-[2rem] border border-border shadow-[0_40px_80px_-48px_rgba(0,63,125,0.45)]",
            )}
          >
            <div className={cn("flex items-center justify-between gap-3 px-5 py-4 lg:px-7 lg:py-5", clean ? "bg-[#F7FAFD]" : "border-b border-border")}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold lg:text-base">JOB-1042 · Kitchen leak repair</p>
                <p className="truncate text-xs text-muted-foreground">214 Palm Avenue, Tampa</p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-500",
                  arrived ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                )}
              >
                <span className={cn("size-1.5 rounded-full", arrived ? "bg-emerald-500" : "bg-amber-500")} />
                {arrived ? "Verified on site" : "En route"}
              </span>
            </div>

            <div className="grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              {/* Map */}
              <div className={cn("relative bg-[#eef3f9] dark:bg-slate-900", !clean && "border-b border-border sm:border-r sm:border-b-0")}>
                <svg viewBox="0 0 320 220" className={cn("block h-full min-h-[14rem] w-full", clean ? "lg:min-h-[19rem]" : "lg:min-h-[24rem]")} role="img" aria-label="Illustration: a pro's marker entering the 200 metre site radius around the home">
                  {/* streets */}
                  <g className="stroke-white dark:stroke-slate-800" strokeWidth="14" strokeLinecap="round" fill="none">
                    <path d="M-10 186 H120 Q150 186 160 160 L176 104" />
                    <path d="M60 -10 V240" />
                    <path d="M-10 60 H330" />
                    <path d="M250 -10 V240" />
                    <path d="M120 230 L330 140" />
                  </g>
                  {/* blocks */}
                  <g className="fill-[#dde6f1] dark:fill-slate-800/70">
                    <rect x="78" y="78" width="54" height="40" rx="6" />
                    <rect x="200" y="150" width="38" height="44" rx="6" />
                    <rect x="268" y="80" width="40" height="52" rx="6" />
                    <rect x="8" y="80" width="38" height="44" rx="6" />
                  </g>
                  {/* 200 m geofence */}
                  <circle
                    cx="176"
                    cy="96"
                    r="46"
                    className={cn(
                      "transition-colors duration-700",
                      arrived ? "fill-emerald-500/15 stroke-emerald-500" : "fill-[#003F7D]/8 stroke-[#003F7D]/50",
                    )}
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                  />
                  {arrived && !reducedMotion ? (
                    <circle cx="176" cy="96" r="46" className="geo-ping fill-none stroke-emerald-500" strokeWidth="1.5" />
                  ) : null}
                  {/* home */}
                  <g transform="translate(176 96)">
                    <circle r="13" className="fill-[#003F7D]" />
                    <path d="M-6 1 L0 -5 L6 1 V6 H-6 Z" className="fill-white" />
                  </g>
                  <text x="176" y="156" textAnchor="middle" className="fill-[#003F7D] text-[9px] font-semibold dark:fill-sky-300">
                    200 m site radius
                  </text>
                  {/* pro */}
                  <g
                    style={{
                      transform: `translate(${marker.x}px, ${marker.y}px)`,
                      transition: reducedMotion ? undefined : "transform 2s cubic-bezier(0.45, 0, 0.2, 1)",
                    }}
                  >
                    <circle r="10" className={cn(arrived ? "fill-emerald-500" : "fill-amber-500", "transition-colors duration-500")} />
                    <circle r="4" className="fill-white" />
                  </g>
                </svg>
                <p className="absolute bottom-2 left-3 text-[10px] text-muted-foreground">Illustration</p>
              </div>

              {/* Updates timeline */}
              <ol className={cn("relative flex flex-col gap-4 p-5", clean ? "lg:gap-5 lg:p-6" : "lg:gap-7 lg:p-7 lg:pt-9")} aria-live="polite">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-7 bottom-7 left-[1.875rem] w-px bg-border",
                    clean ? "lg:top-8 lg:bottom-8 lg:left-[2.125rem]" : "lg:top-11 lg:bottom-11 lg:left-[2.375rem]",
                  )}
                />
                {EVENTS.map((event, index) => {
                  const done = index <= step;
                  return (
                    <li
                      key={event.label}
                      className={cn("relative flex gap-3 transition-opacity duration-500", done ? "opacity-100" : "opacity-35")}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                          done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                          index === step && !reducedMotion && "shadow-[0_0_0_5px_rgba(0,63,125,0.12)]",
                        )}
                      >
                        {done ? <Check className="size-3" aria-hidden="true" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold lg:text-sm">{event.label}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums lg:text-xs">{event.time}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground lg:text-[13px]">{event.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className={cn("order-1 flex min-w-0 flex-col lg:order-2", clean ? "gap-6" : "gap-8")}>
          <div className={cn("flex flex-col", clean ? "gap-3" : "gap-4")}>
            <p className="eyebrow text-primary">On-site verified</p>
            <h2 className={cn("text-balance text-3xl font-semibold tracking-tight", clean ? "md:text-[2.1rem] md:leading-[1.15]" : "md:text-[2.75rem] md:leading-[1.1]")}>
              Know when your pro arrives — and what&apos;s done.
            </h2>
            <p className={cn("max-w-xl text-sm text-muted-foreground", clean ? "leading-6" : "leading-7 md:text-base")}>
              Arrival and crew time are checked against your address with geofencing, and every step of the job
              shows up in your project timeline as it happens.
            </p>
          </div>

          <dl className={cn("flex flex-col", clean ? "gap-4" : "divide-y divide-border")}>
            {POINTS.map((point, index) => {
              const Icon = [MapPin, Clock3, ShieldCheck][index];
              return (
                <div key={point.title} className={cn("flex gap-4", !clean && "py-5 first:pt-0 last:pb-0")}>
                  {clean ? (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F0FA] text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  ) : (
                    <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className={cn("font-semibold tracking-tight", clean ? "text-sm" : "text-[15px]")}>{point.title}</dt>
                    <dd className={cn("text-muted-foreground", clean ? "text-[13px] leading-5" : "text-sm leading-6")}>{point.body}</dd>
                  </div>
                </div>
              );
            })}
          </dl>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Home className="size-3.5 shrink-0" aria-hidden="true" />
            You see the updates — not a live map of the pro.
          </p>
        </div>
      </Container>
    </Section>
  );
}
