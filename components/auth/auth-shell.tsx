import Image from "next/image";
import {
  ClipboardList,
  FileCheck2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { testimonials } from "@/lib/data/content";
import type { DemoRole } from "@/lib/auth/demo-session";
import { cn } from "@/lib/utils";

export const authLinkClass = "font-semibold text-primary hover:text-primary/80";

type PanelPoint = { icon: LucideIcon; label: string };

function panelFor(audience: DemoRole) {
  switch (audience) {
    case "customer":
      return {
        src: "/images/home/hero-home.jpg",
        alt: "Licensed plumber reviewing a kitchen sink repair on a tablet",
        kicker: "Homeowners",
        headline: "Get the work done right.",
        body: "Compare licensed local pros, review an itemized estimate, and hire with a signed scope.",
        points: [
          { icon: ShieldCheck, label: "Licensed and insured professionals" },
          { icon: FileCheck2, label: "Written estimates after a visit" },
          { icon: ClipboardList, label: "Jobs, approvals, and history in one place" },
        ] satisfies PanelPoint[],
        quote: testimonials.find((item) => item.audience === "customer"),
        position: "object-[center_70%]",
      };
    case "provider":
      return {
        src: "/images/home/split-provider.jpg",
        alt: "Service professional reviewing a job on a tablet in a home",
        kicker: "Service companies",
        headline: "Take the jobs that fit.",
        body: "See requests in your service area, send a clear estimate, and keep the original quote intact.",
        points: [
          { icon: ClipboardList, label: "Requests matched to your trades and ZIP" },
          { icon: FileCheck2, label: "Itemized estimates and change orders" },
          { icon: ShieldCheck, label: "Jobs, invoices, and payments in one portal" },
        ] satisfies PanelPoint[],
        quote: testimonials.find((item) => item.audience === "provider"),
        position: "object-[center_30%]",
      };
    default: {
      const _never: never = audience;
      return _never;
    }
  }
}

export function AuthShell({
  title,
  description,
  children,
  footer,
  eyebrow,
  size = "md",
  audience = "customer",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow?: string;
  size?: "md" | "lg";
  audience?: DemoRole;
}) {
  const panel = panelFor(audience);
  const quote = panel.quote;

  return (
    <div className="flex flex-1 items-center justify-center bg-[#f5f5f5] p-3 sm:p-5 lg:p-8">
      <div className="grid w-full max-w-[88rem] overflow-hidden rounded-2xl bg-card shadow-[0_24px_64px_rgba(4,26,54,0.12)] lg:min-h-[min(42rem,calc(100dvh-9rem))] lg:grid-cols-2">
        <aside className="relative isolate min-h-48 overflow-hidden sm:min-h-56 lg:min-h-full">
          <Image
            src={panel.src}
            alt={panel.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={cn("object-cover", panel.position)}
            priority
          />
          <div className="absolute inset-0 bg-[rgba(4,26,54,0.34)]" aria-hidden="true" />
          <div
            className="absolute inset-x-0 bottom-0 h-[72%] bg-[linear-gradient(to_top,rgba(4,26,54,0.88)_0%,rgba(4,26,54,0.42)_55%,transparent_100%)]"
            aria-hidden="true"
          />
          <div className="relative flex h-full min-h-48 flex-col justify-between p-5 text-white sm:min-h-56 sm:p-8 lg:p-10">
            <Logo inverse />
            <div className="hidden max-w-lg lg:flex lg:flex-col lg:gap-6">
              <div>
                <p className="eyebrow text-white/70">{panel.kicker}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight xl:text-4xl">
                  {panel.headline}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/78 xl:text-base">
                  {panel.body}
                </p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {panel.points.map((point) => (
                  <li key={point.label} className="flex items-start gap-2.5 text-sm text-white/88">
                    <point.icon className="mt-0.5 size-4 shrink-0 text-white/70" aria-hidden="true" />
                    {point.label}
                  </li>
                ))}
              </ul>

              {quote ? (
                <figure className="rounded-xl border border-white/15 bg-white/8 p-4 backdrop-blur-sm">
                  <blockquote className="text-sm leading-6 text-white/90">
                    “{quote.quote}”
                  </blockquote>
                  <figcaption className="mt-3 text-xs text-white/65">
                    {quote.name}
                    {quote.company ? ` · ${quote.company}` : ""}
                  </figcaption>
                </figure>
              ) : null}
            </div>
          </div>
        </aside>

        <div
          data-lenis-prevent
          className={cn(
            "flex flex-col overflow-y-auto bg-card",
            "[&_[data-slot=checkbox]]:border-foreground/40",
            size === "lg" ? "justify-start" : "justify-center"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full px-6 py-8 sm:px-8 lg:px-10 lg:py-10",
              size === "lg" ? "max-w-3xl" : "max-w-xl"
            )}
          >
            <div className="mb-6 flex flex-col gap-2">
              {eyebrow ? <p className="eyebrow text-muted-foreground">{eyebrow}</p> : null}
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
