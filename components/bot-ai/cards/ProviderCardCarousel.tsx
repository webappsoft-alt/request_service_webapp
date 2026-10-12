"use client";

import Link from "next/link";
import { BadgeCheck, Check, ExternalLink, MapPin, ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotProviderCard } from "../types";
import { CarouselRail, RailItem } from "./CarouselRail";
import { ProviderAvatar } from "./ProviderAvatar";

function distanceLabel(provider: BotProviderCard) {
  const parts = [] as string[];
  if (typeof provider.distanceMiles === "number") parts.push(`${provider.distanceMiles.toFixed(1)} mi`);
  if (provider.city) parts.push(provider.city);
  return parts.join(" · ") || "Serves your area";
}

export function ProviderCardCarousel({
  providers,
  selectedId,
  onSelect,
}: {
  providers: BotProviderCard[];
  selectedId: string | null;
  onSelect: (provider: BotProviderCard) => void;
}) {
  if (!providers.length) return null;

  return (
    <CarouselRail label="Verified pros" count={providers.length}>
      {providers.map((provider) => {
        const selected = provider.id === selectedId;
        return (
          <RailItem key={provider.id}>
            <article
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border bg-card p-2.5 text-card-foreground shadow-xs transition-colors",
                selected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40",
              )}
            >
              <div className="flex items-center gap-2">
                <ProviderAvatar name={provider.name} src={provider.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <h4 className="flex items-center gap-1 text-[13px] leading-tight font-semibold">
                    <span className="truncate" title={provider.name}>
                      {provider.name}
                    </span>
                    {provider.verified ? (
                      <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" />
                    ) : null}
                  </h4>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px]">
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                    {provider.reviewCount ? (
                      <>
                        <span className="font-semibold">{provider.rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({provider.reviewCount})</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">New on Request Service</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{distanceLabel(provider)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    {[provider.licensed && "Licensed", provider.insured && "Insured"].filter(Boolean).join(" · ") ||
                      "Background reviewed"}
                    {typeof provider.startingPrice === "number" ? ` · from $${provider.startingPrice}` : ""}
                  </span>
                </span>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-1.5">
                {provider.slug ? (
                  <Link
                    href={`/professionals/${provider.slug}`}
                    target="_blank"
                    rel="noopener"
                    draggable={false}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border bg-background text-[11px] font-semibold transition-colors hover:bg-muted"
                  >
                    View Profile
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                ) : (
                  <span className="inline-flex h-7 items-center justify-center rounded-md border border-dashed text-[11px] font-medium text-muted-foreground">
                    View Profile
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(provider)}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors",
                    selected
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {selected ? (
                    <>
                      <Check className="size-3" aria-hidden />
                      Selected
                    </>
                  ) : (
                    "Select Pro"
                  )}
                </button>
              </div>
            </article>
          </RailItem>
        );
      })}
    </CarouselRail>
  );
}
