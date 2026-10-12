"use client";

import { BadgeCheck, CalendarCheck, FileText, Star } from "lucide-react";
import type { BotServiceCard } from "../types";
import { CarouselRail, RailItem } from "./CarouselRail";

function priceOf(service: BotServiceCard) {
  if (typeof service.price !== "number") return { tag: "Quote", value: "Custom price" };
  return { tag: "Fixed", value: `$${service.price.toLocaleString("en-US")}` };
}

function unitLabel(unit?: string | null) {
  const value = unit?.trim();
  if (!value) return null;
  return value.startsWith("/") ? value : `/ ${value}`;
}

export function ServiceCardCarousel({
  services,
  onBook,
  onQuote,
}: {
  services: BotServiceCard[];
  onBook: (service: BotServiceCard) => void;
  onQuote: (service: BotServiceCard) => void;
}) {
  if (!services.length) return null;

  return (
    <CarouselRail label={services.length === 1 ? "Selected service" : "Fixed-price services"} count={services.length}>
      {services.map((service) => {
        const price = priceOf(service);
        const unit = unitLabel(service.unit);
        return (
          // Wide enough to breathe, narrow enough that the next card peeks in.
          <RailItem key={service.id} className="w-[270px] max-w-[88%] min-w-[240px]">
            <article className="group flex h-full flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 text-slate-900 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              <div className="min-w-0 space-y-0.5">
                <h4
                  className="line-clamp-1 text-sm leading-snug font-semibold text-slate-900 dark:text-slate-100"
                  title={service.title}
                >
                  {service.title}
                </h4>
                {service.provider ? (
                  <p className="flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="line-clamp-1" title={service.provider.name}>
                      by {service.provider.name}
                    </span>
                    {service.provider.reviewCount ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-slate-600 dark:text-slate-300">
                        · <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                        {service.provider.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              <p className="line-clamp-2 min-h-[32px] text-xs leading-4 text-slate-600 dark:text-slate-400">
                {service.description || service.subCategoryName || service.categoryName || "Fixed-price service"}
              </p>

              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-baseline gap-1.5 rounded-md bg-emerald-50 px-2.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="text-[10px] font-semibold tracking-wide uppercase opacity-80">{price.tag}</span>
                  <span className="text-sm font-bold tabular-nums">{price.value}</span>
                </span>
                {unit ? (
                  <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{unit}</span>
                ) : null}
              </div>

              <div className="mt-auto flex flex-col items-stretch gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => onBook(service)}
                  disabled={!service.slug}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-primary via-primary to-primary/80 px-3 py-2 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
                  Book this Service
                </button>
                <button
                  type="button"
                  onClick={() => onQuote(service)}
                  className="inline-flex items-center justify-center gap-1 self-center rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FileText className="size-3.5 shrink-0" aria-hidden />
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
