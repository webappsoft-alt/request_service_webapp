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
import { getProviderCardCover } from "@/lib/data/provider-media";
import { getServiceCategoryById } from "@/lib/data/services";
import type { ExplorePlace } from "@/lib/data/profile-explore";
import { formatProviderCardLocation } from "@/lib/format";
import { servicesForProviderHref } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Provider } from "@/lib/types";

/** Unique labels already scoped to this pro — leftover is list.length − 2. */
function cardServiceLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(label);
  }
  return next;
}

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
  servesLabel,
  className,
}: {
  city?: string | null;
  state?: string | null;
  /** Location search active: the covered place instead of the business address. */
  servesLabel?: string;
  className?: string;
}) {
  const label = servesLabel ? `Serves ${servesLabel}` : formatProviderCardLocation(city, state);
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

/** Case/punctuation-insensitive key for matching a service label to a filter. */
function serviceKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ServiceBadges({
  services,
  highlighted,
  hidden,
  className,
}: {
  services: string[];
  highlighted?: string;
  hidden: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {services.map((service) => (
        <Badge
          key={service}
          variant="secondary"
          className={cn(
            service === highlighted &&
              "bg-primary text-primary-foreground ring-1 ring-primary/30 dark:bg-primary dark:text-primary-foreground",
          )}
        >
          {service}
        </Badge>
      ))}
      {hidden.length ? (
        <Badge variant="secondary" title={hidden.join(", ")}>
          +{hidden.length} more
        </Badge>
      ) : null}
    </div>
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
  highlightService,
  servesLabel,
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
  /** Selected sub-service filter: its badge is shown first and highlighted when the pro offers it. */
  highlightService?: string;
  /**
   * The searched City + State (or state) — it's why this pro matched, so the card shows
   * "Serves Denver, CO" instead of the business address.
   */
  servesLabel?: string;
}) {
  const categories = provider.categoryIds
    .map((id) => getServiceCategoryById(id))
    .filter((category): category is NonNullable<typeof category> => Boolean(category));
  const allServices = cardServiceLabels(
    provider.serviceLabels?.length
      ? provider.serviceLabels
      : categories.map((category) => category.name),
  );
  const highlightKey = serviceKey(highlightService || "");
  const highlighted = highlightKey
    ? allServices.find((service) => serviceKey(service) === highlightKey)
    : undefined;
  // The filtered sub-service leads so it is never hidden behind "+N more".
  const orderedServices = highlighted
    ? [highlighted, ...allServices.filter((service) => service !== highlighted)]
    : allServices;
  const services = orderedServices.slice(0, 2);
  const hiddenServices = orderedServices.slice(services.length);
  // Card photo = main business gallery banner. Small logo overlay stays on ProviderLogo.
  const coverImage = getProviderCardCover(provider);
  // Visual marketplace cards always keep the photo header layout (previous design).
  const showCover = visual;
  const showListPhoto = !visual;
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
          "h-full flex-col gap-5 border-input p-5 transition-[transform,box-shadow] duration-300 ease-out sm:flex-row sm:items-stretch sm:gap-6",
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
            className="object-cover!"
            style={{ objectFit: "cover" }}
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
                <ProviderCardLocation city={provider.city} state={provider.state} servesLabel={servesLabel} />
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
              <ServiceBadges services={services} highlighted={highlighted} hidden={hiddenServices} />
            ) : null}
          </div>

          <div className="flex shrink-0 flex-row items-end justify-end gap-4 sm:w-44 sm:flex-col sm:items-end sm:justify-end">
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
        "h-full border-input transition-[transform,box-shadow] duration-300 ease-out",
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
            className="object-cover!"
            style={{ objectFit: "cover" }}
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
            <h3
              className="min-w-0 capitalize text-sm leading-snug font-semibold sm:text-[0.95rem]"
              title={provider.companyName}
            >
              <span className="line-clamp-2 break-words">{provider.companyName}</span>
            </h3>
            <p className="line-clamp-1 text-sm leading-5 text-muted-foreground">
              {provider.tagline}
            </p>
            <ProviderCardLocation
              city={provider.city}
              state={provider.state}
              servesLabel={servesLabel}
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
          <ServiceBadges
            className="min-h-11 shrink-0 content-start"
            services={services}
            highlighted={highlighted}
            hidden={hiddenServices}
          />
        ) : (
          <div className="min-h-11 shrink-0" aria-hidden="true" />
        )}

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
              href={servicesForProviderHref(provider)}
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
