"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Container, Section } from "@/components/layout/container";
import { ProScreenshot } from "@/components/pro/pro-screenshot";
import { featured } from "@/components/pro/pro-workflow";
import { cn } from "@/lib/utils";

/** Move to the next tab after this long, until the visitor picks one. */
const AUTO_ADVANCE_MS = 7000;

/**
 * The portal in one place: a tab bar (Leads · Estimates · Schedule · Jobs · Invoices · Messages)
 * over a single real screenshot, with that area's summary and checklist underneath — instead of
 * six alternating screenshot blocks. Auto-advances while on screen until a tab is clicked.
 */
export function ProShowcase() {
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const item = featured[active];

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pinned || !inView) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % featured.length), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [active, pinned, inView]);

  // Keep the active tab visible in the scrollable bar (phones) without scrolling the page.
  useEffect(() => {
    const tab = tabRefs.current[active];
    const bar = tab?.parentElement;
    if (!tab || !bar) return;
    bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.clientWidth) / 2, behavior: "smooth" });
  }, [active]);

  const choose = (index: number) => {
    setPinned(true);
    setActive(index);
  };

  return (
    <Section id="how-it-works" className="scroll-mt-24 bg-muted/50">
      <Container ref={rootRef} className="flex flex-col gap-8 lg:gap-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="eyebrow text-primary">The portal</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
            The office, in one login.
          </h2>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground md:text-base">
            Leads through payment on the same record. Real screens from the pro portal, not mock-ups.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {/* Tab bar */}
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Portal areas"
              className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-background p-1 [scrollbar-width:none]"
            >
              {featured.map((tab, index) => (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${tab.id}`}
                  aria-selected={index === active}
                  aria-controls="showcase-panel"
                  onClick={() => choose(index)}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    index === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {index === active && !pinned && inView ? (
                    <span
                      key={active}
                      aria-hidden="true"
                      className="showcase-progress absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-white/60"
                      style={{ animationDuration: `${AUTO_ADVANCE_MS}ms` }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot */}
          <div
            id="showcase-panel"
            role="tabpanel"
            aria-labelledby={`showcase-tab-${item.id}`}
            className="mx-auto w-full max-w-5xl"
          >
            <div key={item.id} className="animate-in fade-in zoom-in-[0.99] duration-500">
              <ProScreenshot name={item.shot} alt={item.alt} url={item.url} sizes="(min-width: 1280px) 64rem, 100vw" />
            </div>

            {/* What this area does */}
            <div
              key={`${item.id}-copy`}
              className="animate-in fade-in slide-in-from-bottom-1 mt-6 grid gap-6 duration-500 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
            >
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                  {item.number} · {item.label}
                </p>
                <h3 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.body}</p>
              </div>
              <ul className="flex flex-col divide-y divide-border self-start">
                {item.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0 lg:first:pt-1">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
