"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  FileText,
  Inbox,
  Receipt,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const journey = [
  { title: "Capture", status: "New", detail: "Maya Chen · 80014", icon: Inbox },
  { title: "Quote", status: "Signed", detail: "EST-2841 · $1,840", icon: FileText },
  { title: "Schedule", status: "Thu 9:00", detail: "On the crew calendar", icon: CalendarDays },
  { title: "On site", status: "In progress", detail: "Approved scope only", icon: Wrench },
  { title: "Invoice", status: "INV-1042", detail: "Estimate + extras", icon: Receipt },
  { title: "Paid", status: "Settled", detail: "Deposit + balance", icon: Wallet },
] as const;

const LAST = journey.length - 1;

export function ProJobFile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActive(LAST);
      setStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const delay = active === LAST ? 2200 : 900;
    const timer = window.setTimeout(() => {
      setActive((current) => (current >= LAST ? -1 : current + 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [started, active]);

  const progress = Math.max(0, active) / LAST;

  return (
    <div
      ref={rootRef}
      className="relative overflow-hidden rounded-2xl border border-black/15 bg-card shadow-[0_28px_64px_-28px_rgba(0,63,125,0.35)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="size-2 rounded-full bg-black/15" />
            <span className="size-2 rounded-full bg-black/15" />
            <span className="size-2 rounded-full bg-black/15" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Job file RS-2841</p>
            <p className="truncate text-xs text-muted-foreground">
              Water heater replacement · Aurora
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
          One record
        </span>
      </div>

      <ol className="relative grid gap-6 px-5 py-6 sm:grid-cols-2 xl:grid-cols-6 xl:gap-4 xl:px-6 xl:py-7">
        <span
          className="pointer-events-none absolute top-[3.15rem] right-10 left-10 hidden h-px bg-primary/15 xl:block"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute top-[3.15rem] left-10 hidden h-0.5 origin-left bg-primary xl:block"
          style={{
            width: `calc((100% - 5rem) * ${progress})`,
            transition: "width 850ms ease-out",
          }}
          aria-hidden="true"
        />

        {journey.map((step, index) => {
          const Icon: LucideIcon = step.icon;
          const on = index <= active;
          const current = index === active;

          return (
            <li key={step.title} className="relative flex flex-col items-start gap-3">
              <span
                className={cn(
                  "relative z-10 flex size-11 items-center justify-center rounded-full transition-all duration-500",
                  on
                    ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(0,63,125,0.7)]"
                    : "bg-[#E7F0F8] text-[#5C87B0] ring-1 ring-primary/12",
                  current && "ring-2 ring-primary/25",
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p
                  className={cn(
                    "font-mono text-[0.65rem] tracking-[0.14em] transition-colors duration-500",
                    on ? "text-primary" : "text-[#7A9EBF]",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p
                  className={cn(
                    "mt-1 font-semibold transition-colors duration-500",
                    on ? "text-foreground" : "text-[#4E7598]",
                  )}
                >
                  {step.title}
                </p>
              </div>
              <div
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 transition-colors duration-500",
                  on ? "bg-primary/8" : "border border-primary/10 bg-[#F3F7FB]",
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-medium transition-colors duration-500",
                    on ? "text-primary" : "text-[#4E7598]",
                  )}
                >
                  {step.status}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-5 transition-colors duration-500",
                    on ? "text-muted-foreground" : "text-[#7A9EBF]",
                  )}
                >
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
