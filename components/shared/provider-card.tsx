"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CredentialMark, credentialLabel } from "@/components/shared/credential-mark";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { Rating } from "@/components/shared/rating";
import { getProviderPresence } from "@/lib/data/service-directory";
import {
  getProviderProfileImage,
  getStartingPrice,
} from "@/lib/data/provider-media";
import { getServiceCategoryById } from "@/lib/data/services";
import type { ExplorePlace } from "@/lib/data/profile-explore";
import { formatProviderCardLocation, formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";

function professionalHref(slug: string, place?: ExplorePlace) {
  const params = new URLSearchParams();
  if (place?.zip && /^\d{5}$/.test(place.zip)) params.set("zip", place.zip);
  if (place?.city) params.set("city", place.city);
  if (place?.state) params.set("state", place.state);
  if (place?.location && !place.city && !place.zip) params.set("location", place.location);
  const query = params.toString();
  return query ? `/professionals/${slug}?${query}` : `/professionals/${slug}`;
}

function ProviderCardLocation({
  city,
  state,
  className,
}: {
  city?: string | null;
  state?: string | null;
  className?: string;
}) {
  const label = formatProviderCardLocation(city, state);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-sm text-muted-foreground",
        className,
      )}
      title={label}
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export function ProviderCard({
  provider,
  visual = false,
  hideCredentials = false,
  active = false,
  place,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onBeforeNavigate,
}: {
  provider: Provider;
  visual?: boolean;
  hideCredentials?: boolean;
  active?: boolean;
  place?: ExplorePlace;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Stash list/detail data before navigating to the profile (Fixed Services pattern). */
  onBeforeNavigate?: () => void;
}) {
  const categories = provider.categoryIds
    .map((id) => getServiceCategoryById(id))
    .filter((category): category is NonNullable<typeof category> => Boolean(category));
  const services = (
    provider.serviceLabels?.length
      ? provider.serviceLabels
      : categories.map((category) => category.name)
  ).slice(0, 4);
  // Card photo = profile avatar only (never portfolio / project / service images).
  const coverImage = getProviderProfileImage(provider);
  // Visual marketplace cards always keep the photo header layout (previous design).
  const showCover = visual;
  const showListPhoto = !visual;
  const startingPrice = getStartingPrice(provider);
  const hasCredentials = provider.licensed || provider.insured;
  const hasRating = provider.rating > 0;
  const presence = getProviderPresence(provider.id);
  const profileHref = professionalHref(provider.slug, place);
  const description = provider.description?.trim() || "";
  const contactName = provider.contact?.name?.trim() || "";
  const categoryBadge =
    categories[0]?.shortName ||
    categories[0]?.name ||
    services[0] ||
    "Pro";

  function handleProfileClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
    onBeforeNavigate?.();
  }

  if (showListPhoto && coverImage) {
    return (
      <Card
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          "h-full flex-col gap-5 border-black/15 p-5 transition-[transform,box-shadow] duration-300 ease-out sm:flex-row sm:items-stretch sm:gap-6",
          "hover:-translate-y-1 hover:elevate",
          onClick && "cursor-pointer",
          active && "-translate-y-1 elevate-lg",
          className,
        )}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted sm:aspect-auto sm:min-h-[13.5rem] sm:w-72 sm:shrink-0 lg:w-80">
          <Image
            src={coverImage}
            alt={provider.companyName}
            fill
            sizes="(max-width: 640px) 90vw, 288px"
            className="object-cover"
            unoptimized={coverImage.startsWith("http")}
          />
          <span className="absolute top-3 left-3 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
            {categoryBadge}
          </span>
          {presence.online ? (
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Available now
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xl leading-snug font-semibold tracking-tight">
                {provider.companyName}
              </h3>
              {contactName ? (
                <p className="text-sm text-muted-foreground">
                  Contact: <span className="text-foreground/80">{contactName}</span>
                  {provider.contact?.role ? (
                    <span className="text-muted-foreground"> · {provider.contact.role}</span>
                  ) : null}
                </p>
              ) : null}
              <p className="line-clamp-1 text-sm text-muted-foreground">{provider.tagline}</p>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {hasRating ? (
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Star className="size-3.5 fill-current text-warning" aria-hidden="true" />
                    {provider.rating.toFixed(1)}
                    <span className="font-normal text-muted-foreground">
                      ({provider.reviewCount} reviews)
                    </span>
                  </span>
                ) : null}
                <ProviderCardLocation city={provider.city} state={provider.state} />
                {!hideCredentials && hasCredentials ? (
                  <span className="text-sm text-muted-foreground">
                    {credentialLabel(provider.licensed, provider.insured)}
                  </span>
                ) : null}
                {provider.yearsInBusiness > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {provider.yearsInBusiness} years in business
                  </span>
                ) : null}
              </span>
            </div>
            {description ? (
              <p className="line-clamp-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
            {services.length ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map((service) => (
                  <Badge key={service} variant="secondary">
                    {service}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-row items-end justify-between gap-4 sm:w-44 sm:flex-col sm:items-end sm:justify-between">
            <span className="flex flex-col gap-1 sm:items-end">
              <span className="text-xs text-muted-foreground">Typical start</span>
              <span className="text-2xl leading-none font-semibold tabular-nums">
                {formatStartingPrice(startingPrice)}
              </span>
            </span>
            <Button asChild size="sm">
              <Link href={profileHref} onClick={handleProfileClick}>
                View profile
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "h-full border-black/15 transition-[transform,box-shadow] duration-300 ease-out",
        showCover && "gap-0 pt-0",
        "pb-2",
        "hover:-translate-y-1 hover:elevate",
        onClick && "cursor-pointer",
        active && "-translate-y-1 elevate-lg",
        className,
      )}
    >
      {showCover ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={coverImage}
            alt={provider.companyName}
            fill
            sizes="(max-width: 768px) 82vw, 25vw"
            className="object-cover"
            unoptimized={coverImage.startsWith("http")}
          />
          <span
            className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/25"
            aria-hidden="true"
          />
          {hasRating ? (
            <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Star className="size-3 fill-warning text-warning" aria-hidden="true" />
              {provider.rating.toFixed(1)}
              <span className="text-white/75">
                ({provider.reviewCount.toLocaleString("en-US")})
              </span>
            </span>
          ) : null}
          {!hideCredentials && hasCredentials ? (
            <CredentialMark
              licensed={provider.licensed}
              insured={provider.insured}
              tone="photo"
              className="absolute top-2 right-2 z-10"
            />
          ) : null}
          <ProviderLogo
            provider={provider}
            size="sm"
            className="absolute bottom-2.5 left-2.5 z-10 shadow-sm"
          />
        </div>
      ) : null}
{/*  */}
      <div className={cn("flex min-h-0 flex-1 flex-col gap-3 px-3 pt-3 pb-3 sm:px-4", !showCover && "pt-0")}>
        <div className="flex shrink-0 items-start gap-3">
          {showCover ? null : <ProviderLogo provider={provider} size="xl" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="min-w-0 flex-1 capitalize text-sm leading-snug font-semibold sm:text-[0.95rem]"
                title={provider.companyName}
              >
                <span className="line-clamp-2 break-words">{provider.companyName}</span>
              </h3>
              <span className="shrink-0 pt-0.5 text-sm leading-snug font-semibold tabular-nums text-brand sm:text-[0.95rem]">
                {formatStartingPrice(startingPrice)}
              </span>
            </div>
            <p className="line-clamp-1 text-sm leading-5 text-muted-foreground">
              {provider.tagline}
            </p>
            <ProviderCardLocation
              city={provider.city}
              state={provider.state}
              className="leading-5"
            />
          </div>
        </div>

        {showCover ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {hasRating ? (
              <Rating value={provider.rating} count={provider.reviewCount} />
            ) : null}
            {hasCredentials ? (
              <CredentialMark licensed={provider.licensed} insured={provider.insured} />
            ) : null}
          </div>
        )}

        {visual ? null : (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
            {provider.description}
          </p>
        )}

        {services.length ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {services.map((service) => (
              <Badge key={service} variant="secondary">
                {service}
              </Badge>
            ))}
          </div>
        ) : null}

        {visual ? null : (
          <p className="text-sm leading-5 text-muted-foreground">
            {provider.yearsInBusiness} years in business · {provider.employeeCount} team
          </p>
        )}

        <div className="mt-auto flex w-full flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            asChild
            size="sm"
            className="h-8 w-full sm:min-w-0 sm:flex-1"
          >
            <Link
              href={`/request-service?provider=${provider.slug}`}
              onClick={(event) => event.stopPropagation()}
              className="justify-center whitespace-nowrap"
            >
              Request service
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 w-full sm:min-w-0 sm:flex-1">
            <Link
              href={profileHref}
              onClick={handleProfileClick}
              className="justify-center whitespace-nowrap"
            >
              View profile
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
