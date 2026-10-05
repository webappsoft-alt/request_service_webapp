"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { customerWorkflow } from "@/lib/data/navigation";
import { cn } from "@/lib/utils";

type WorkflowStep = {
  step: number;
  title: string;
  body: string;
  phase: string;
  image: string;
  imageAlt: string;
  href: string;
  cta: string;
};

const WORKFLOW_STEPS: WorkflowStep[] = customerWorkflow.map((item, index) => {
  const extras = [
    {
      phase: "Start",
      image:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Home service tools ready for a project",
      href: "/find-a-professional",
      cta: "Browse services",
    },
    {
      phase: "Request",
      image:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Homeowner filling out project details on a laptop",
      href: "/get-a-quote",
      cta: "Start a request",
    },
    {
      phase: "Match",
      image:
        "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Homeowner meeting with local service professionals",
      href: "/find-a-professional",
      cta: "Find professionals",
    },
    {
      phase: "Quote",
      image:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Written estimate with line items on a desk",
      href: "/how-it-works",
      cta: "See the estimate flow",
    },
    {
      phase: "Approve",
      image:
        "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Customer approving and signing on a tablet",
      href: "/how-it-works",
      cta: "How signing works",
    },
    {
      phase: "Job",
      image:
        "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Crew completing home renovation work",
      href: "/how-it-works",
      cta: "From estimate to job",
    },
    {
      phase: "Pay",
      image:
        "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
      imageAlt: "Invoice and payment for completed work",
      href: "/get-a-quote",
      cta: "Get a written estimate",
    },
  ] as const;

  const extra = extras[index] ?? extras[0];
  return {
    step: item.step,
    title: item.title,
    body: item.body,
    ...extra,
  };
});

const TOTAL = WORKFLOW_STEPS.length;

/** Layout slot stays fixed so the track slide stays smooth. */
const SLOT_REM = 15;
const GAP_REM = 0.875; // gap-3.5
const PREV_PEEK_REM = SLOT_REM * 0.04; // ~4% previous-card peek

function stepLabel(step: number) {
  return String(step).padStart(2, "0");
}

export function WorkflowSection() {
  const labelId = useId();
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const current = WORKFLOW_STEPS[active] ?? WORKFLOW_STEPS[0];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback((index: number) => {
    setActive(((index % TOTAL) + TOTAL) % TOTAL);
  }, []);

  const prev = useCallback(() => goTo(active - 1), [active, goTo]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const stride = SLOT_REM + GAP_REM;
  // Active stays in the leading slot; previous card peeks on the left.
  const trackOffsetRem =
    active === 0 ? 0 : -(active * stride) + PREV_PEEK_REM;

  return (
    <Section className="relative bg-white">
      {/* Soft lift from the assurance / trust band above */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0"
      >
        <svg
          className="absolute inset-x-0 -top-10 h-10 w-full text-white"
          viewBox="0 0 1440 40"
          preserveAspectRatio="none"
        >
          <path
            fill="currentColor"
            d="M0 40C240 8 480 0 720 0s480 8 720 40V40H0Z"
          />
        </svg>
        <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(0,63,125,0.05),transparent)]" />
      </div>

      <Container className="relative z-[1] grid items-stretch gap-10 pt-2 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        {/* Left narrative rail */}
        <div className="flex flex-col lg:min-h-[28rem]">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-primary/40" aria-hidden="true" />
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              · 04 / How it works
            </p>
          </div>
          <h2
            id={labelId}
            className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-[2.35rem] md:leading-[1.15]"
          >
            From choosing a service to paying the invoice
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
            Seven steps. One file. The estimate you sign is the job that gets done and the invoice
            you pay.
          </p>

          <div className="mt-8 hidden border-t border-input pt-6 lg:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Active step
                </p>
                <p className="mt-1.5 truncate text-base font-semibold tracking-tight">
                  {current.title}
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                {stepLabel(current.step)} / {stepLabel(TOTAL)}
              </p>
            </div>

            <div
              className="mt-5 flex gap-1.5"
              role="tablist"
              aria-label="Workflow steps"
            >
              {WORKFLOW_STEPS.map((step, index) => (
                <button
                  key={step.step}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Go to step ${step.step}: ${step.title}`}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-all duration-500",
                    index === active
                      ? "bg-foreground"
                      : "bg-foreground/15 hover:bg-foreground/30",
                  )}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                disabled={active === 0}
                aria-label="Previous step"
                className="flex size-11 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={next}
                disabled={active === TOTAL - 1}
                aria-label="Next step"
                className="flex size-11 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              Full walkthrough
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row lg:hidden">
            <Button size="lg" asChild>
              <Link href="/get-a-quote">
                Get a written estimate
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/find-a-professional">Find a professional</Link>
            </Button>
          </div>
        </div>

        {/* Right column: track + stationary CTAs */}
        <div className="relative flex min-w-0 flex-col">
          {/* Fixed-height swipe viewport so CTA buttons never jump */}
          <div
            className="relative h-[22.75rem] overflow-x-clip"
            aria-labelledby={labelId}
            onTouchStart={(event) => {
              touchX.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchX.current == null) return;
              const dx =
                (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
              if (Math.abs(dx) > 48) goTo(active + (dx < 0 ? 1 : -1));
              touchX.current = null;
            }}
          >
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-linear-to-l from-white to-transparent lg:block" />

            <ul
              className="flex h-full items-end gap-3.5 will-change-transform"
              style={{
                transform: `translate3d(${trackOffsetRem}rem, 0, 0)`,
                transition: reducedMotion
                  ? "none"
                  : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {WORKFLOW_STEPS.map((step, index) => {
                const isActive = index === active;
                return (
                  <li
                    key={step.step}
                    className="flex w-[15rem] shrink-0 items-end justify-center"
                  >
                    <article
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-[12px] text-left",
                        "transition-[width,height,box-shadow,opacity,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isActive
                          ? "z-10 h-[22.75rem] w-[16.5rem] shadow-[0_14px_36px_rgba(15,23,42,0.16)]"
                          : "z-0 h-[20rem] w-[15rem] opacity-55 shadow-[0_6px_18px_rgba(15,23,42,0.07)] grayscale-[35%] hover:opacity-80",
                      )}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        className="absolute inset-0 z-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={`Step ${step.step}: ${step.title}`}
                      />
                      <Image
                        src={step.image}
                        alt={step.imageAlt}
                        fill
                        sizes="280px"
                        className="pointer-events-none rounded-[12px] object-cover"
                        priority={index < 2}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 rounded-[12px] bg-linear-to-t from-black/88 via-black/35 to-black/10"
                        aria-hidden="true"
                      />

                      <div className="relative z-10 mt-auto flex flex-col gap-1.5 p-4 sm:p-5">
                        <p className="pointer-events-none font-mono text-[10px] tracking-[0.16em] text-white/75 uppercase">
                          {stepLabel(step.step)} · {step.phase}
                        </p>
                        <h3
                          className={cn(
                            "pointer-events-none font-semibold tracking-tight text-white transition-[font-size] duration-500",
                            isActive ? "text-lg sm:text-xl" : "text-base",
                          )}
                        >
                          {step.title}
                        </h3>

                        {isActive ? (
                          <>
                            <p className="pointer-events-none text-pretty text-sm leading-6 text-white/80">
                              {step.body}
                            </p>
                            <Link
                              href={step.href}
                              className="relative z-20 mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-white/90"
                            >
                              {step.cta}
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile progress — outside swipe track */}
          <div className="mt-5 flex items-center justify-between gap-4 lg:hidden">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {stepLabel(current.step)} / {stepLabel(TOTAL)} · {current.phase}
            </p>
            <div className="flex max-w-[10rem] flex-1 gap-1">
              {WORKFLOW_STEPS.map((step, index) => (
                <span
                  key={step.step}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    index === active ? "bg-foreground" : "bg-foreground/15",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Stationary CTAs — never inside the swipe/transform area */}
          <div className="mt-6 hidden gap-3 lg:flex">
            <Button size="lg" asChild>
              <Link href="/get-a-quote">
                Get a written estimate
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-input bg-card" asChild>
              <Link href="/find-a-professional">Find a professional</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
