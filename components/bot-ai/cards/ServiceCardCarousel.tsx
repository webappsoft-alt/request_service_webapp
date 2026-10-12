"use client";

import { CalendarCheck, Clock3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { findProvider } from "../mockData";
import type { MockService } from "../types";
import { CarouselRail, RailItem } from "./CarouselRail";

function priceLabel(pricing: MockService["pricing"]) {
  if (pricing.type === "fixed") {
    return pricing.amount === 0
      ? { tag: "Free", value: "Estimate visit" }
      : { tag: "Fixed", value: `$${pricing.amount}` };
  }
  return { tag: "Est.", value: `$${pricing.min} – $${pricing.max}` };
}

export function ServiceCardCarousel({
  services,
  highlightSubServiceId,
  onBook,
  onQuote,
}: {
  services: MockService[];
  highlightSubServiceId?: string | null;
  onBook: (service: MockService) => void;
  onQuote: (service: MockService) => void;
}) {
  if (!services.length) return null;

  return (
    <CarouselRail label={services.length === 1 ? "Selected service" : "Services"} count={services.length}>
      {services.map((service) => {
        const price = priceLabel(service.pricing);
        const provider = findProvider(service.providerId);
        const recommended =
          services.length > 1 && Boolean(highlightSubServiceId) && service.subServiceId === highlightSubServiceId;
        return (
          <RailItem key={service.id} className="w-56">
            <article
              className={cn(
                "relative flex h-full flex-col gap-1.5 rounded-xl border bg-card p-2.5 text-card-foreground shadow-xs transition-colors hover:border-primary/40",
                recommended && "border-primary/60",
              )}
            >
              {recommended ? (
                <span className="absolute -top-2 right-2.5 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold tracking-wide text-primary-foreground uppercase">
                  Best match
                </span>
              ) : null}

              <div className="min-w-0">
                <h4 className="truncate text-[13px] leading-snug font-semibold" title={service.title}>
                  {service.title}
                </h4>
                {provider ? (
                  <p className="truncate text-[10px] font-medium text-muted-foreground">by {provider.name}</p>
                ) : null}
              </div>
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{service.description}</p>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-baseline gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                  <span className="text-[9px] font-bold tracking-wide uppercase">{price.tag}</span>
                  <span className="text-xs font-bold">{price.value}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden />
                  {service.duration}
                </span>
              </div>

              <div className="mt-auto flex flex-col gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => onBook(service)}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-primary px-1 text-[11px] font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <CalendarCheck className="size-3 shrink-0" aria-hidden />
                  Book this Service
                </button>
                <button
                  type="button"
                  onClick={() => onQuote(service)}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-md border bg-background px-1 text-[11px] font-semibold whitespace-nowrap transition-colors hover:bg-muted"
                >
                  <FileText className="size-3 shrink-0" aria-hidden />
                  Get a Quote
                </button>
              </div>
            </article>
          </RailItem>
        );
      })}
    </CarouselRail>
  );
}
