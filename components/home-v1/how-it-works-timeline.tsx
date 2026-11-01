"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSignature, FolderOpen, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: MapPin,
    title: "Tell Us What You Need",
    body: "Select a service, enter your ZIP Code, and describe your project. Add photos to help professionals understand the job.",
  },
  {
    icon: Users,
    title: "Connect With Local Pros",
    body: "Find professionals who serve your area and offer the service you need. Review profiles, experience, and available customer feedback.",
  },
  {
    icon: FileSignature,
    title: "Review Estimates & Hire",
    body: "Discuss project details, review written estimates, ask questions, and choose the professional who fits your needs.",
  },
  {
    icon: FolderOpen,
    title: "Manage Your Project",
    body: "Keep messages, project details, schedules, and estimates organized in one convenient place.",
  },
] as const;

/** Advance one step every few seconds until the visitor picks one themselves. */
const AUTO_ADVANCE_MS = 4500;

/**
 * "How it works" as one connected timeline (no card grid): a progress rail with four nodes;
 * the active step's text is shown large underneath. Horizontal on desktop, vertical on phones.
 */
export function HowItWorksTimeline() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((step) => (step + 1) % STEPS.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [pinned]);

  const choose = (index: number) => {
    setPinned(true);
    setActive(index);
  };
  const progress = (active / (STEPS.length - 1)) * 100;

  return (
    <Section className="bg-muted/50">
      <Container className="flex flex-col gap-14 lg:gap-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="eyebrow text-primary">Built for homeowners</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Find the Right Home Service Professional.{" "}
              <span className="text-primary">Get the Job Done.</span>
            </h2>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Tell us what you need, connect with local professionals, review written estimates, and manage your
              project—all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/get-a-quote">
                Request a quote
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href="/find-a-professional">Browse professionals</Link>
            </Button>
          </div>
        </div>

        {/* Desktop: horizontal rail */}
        <div className="hidden lg:block">
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-x-[12.5%] top-7 h-0.5 rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <ol className="relative grid grid-cols-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const reached = index <= active;
                return (
                  <li key={step.title} className="flex flex-col items-center px-4 text-center">
                    <button
                      type="button"
                      onClick={() => choose(index)}
                      aria-current={index === active ? "step" : undefined}
                      className="group flex flex-col items-center gap-4 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "flex size-14 items-center justify-center rounded-full border-2 transition-all duration-500",
                          reached
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground group-hover:border-primary/50",
                          index === active && "scale-110 shadow-[0_0_0_8px_rgba(0,63,125,0.10)]",
                          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2",
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "text-base font-semibold tracking-tight transition-colors",
                          index === active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {step.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <p
            key={active}
            className="animate-in fade-in slide-in-from-bottom-1 mx-auto mt-12 max-w-2xl text-center text-lg leading-8 text-foreground/80 duration-500"
          >
            {STEPS[active].body}
          </p>
        </div>

        {/* Phones / tablets: vertical rail, every step readable */}
        <ol className="relative flex flex-col gap-9 lg:hidden">
          <span aria-hidden="true" className="absolute top-2 bottom-2 left-[1.375rem] w-0.5 bg-border" />
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative flex gap-5">
                <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}
