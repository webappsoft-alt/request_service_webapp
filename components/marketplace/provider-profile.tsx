import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, CreditCard, Globe, Languages, Mail, MapPin, Phone, UserRound, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { CredentialMark } from "@/components/shared/credential-mark";
import { HomeMotion } from "@/components/home/home-motion";
import { PortfolioGallery } from "@/components/marketplace/portfolio-lightbox";
import { ProfileExplore } from "@/components/marketplace/profile-explore";
import { ProviderProjects } from "@/components/marketplace/provider-projects";
import {
  BookServiceButton,
  BookServiceProvider,
} from "@/components/marketplace/book-service-panel";
import { FixedServiceCatalog } from "@/components/marketplace/fixed-service-catalog";
import { ProviderChat } from "@/components/marketplace/provider-chat";
import { ProviderReviews } from "@/components/marketplace/provider-reviews";
import { ProviderCard } from "@/components/shared/provider-card";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { Rating } from "@/components/shared/rating";
import { ServiceOfferCard } from "@/components/shared/service-card";
import { ServiceAreaMapLazy } from "@/components/marketplace/service-area-map-lazy";
import { ProviderCardSkeleton } from "@/components/shared/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  displayWebsite,
  getProviderContact,
  getProviderWebsite,
} from "@/lib/data/provider-contact";
import { getProviderPhotos } from "@/lib/data/provider-media";
import { getProviderSocials } from "@/lib/data/provider-socials";
import { getProfileExplore, type ExplorePlace } from "@/lib/data/profile-explore";
import { getProviderProjects } from "@/lib/data/provider-projects";
import { getPortalServices, type PortalFixedService } from "@/lib/data/portal";
import { getRelatedProviders } from "@/lib/data/providers";
import { getServiceAreaNames } from "@/lib/data/service-areas";
import { formatHoursValue, formatLocation, formatWorkingDay, getTodayWeekday } from "@/lib/format";
import { formatPaymentMethodsLabel } from "@/lib/provider-preferences";
import { servicesForProviderHref } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Provider, ProviderProject, ServiceCategory } from "@/lib/types";

export type ProviderProfileLiveData = {
  photos?: { src: string; alt: string }[];
  projects?: ProviderProject[];
  relatedProviders?: Provider[];
  fixedServices?: PortalFixedService[];
  areaLabels?: string[];
  portfolioLoading?: boolean;
  relatedLoading?: boolean;
  onRelatedBeforeNavigate?: (provider: Provider) => void;
  onProjectBeforeNavigate?: () => void;
};

export function ProviderProfile({
  provider,
  categories,
  place,
  live,
}: {
  provider: Provider;
  categories: ServiceCategory[];
  place?: ExplorePlace;
  /** When set, use API-backed section data instead of static mock helpers. */
  live?: ProviderProfileLiveData;
}) {
  const isLive = Boolean(live);
  const photos = live?.photos ?? getProviderPhotos(provider);
  const projects = live ? (live.projects ?? []) : getProviderProjects(provider);
  const relatedProviders = live
    ? (live.relatedProviders ?? [])
    : getRelatedProviders(provider);
  const explore = getProfileExplore(provider, categories, place);
  const areas =
    live?.areaLabels?.length
      ? live.areaLabels
      : getServiceAreaNames(provider.serviceArea);
  const today = getTodayWeekday();
  const socials = getProviderSocials(provider);
  const contact = isLive ? provider.contact : getProviderContact(provider);
  const website = isLive
    ? (provider.website?.trim() || "")
    : getProviderWebsite(provider);
  const fixedServices = live
    ? (live.fixedServices ?? [])
    : getPortalServices(provider).filter((item) => item.active);
  const showHours = isLive || provider.workingHours.length > 0;
  const showRelated = isLive || relatedProviders.length > 0;
  const yearsInBusiness =
    provider.yearsInBusiness > 0
      ? provider.yearsInBusiness
      : provider.foundedYear > 0
        ? Math.max(0, new Date().getFullYear() - provider.foundedYear)
        : 0;
  const paymentMethodsLabel = formatPaymentMethodsLabel(
    provider.paymentMethods,
  );
  const languageLabel = provider.language?.trim() || "";
  const ownerName = contact?.name?.trim() || "";
  const ownerRole = contact?.role?.trim() || "";
  const addressLine = provider.street?.trim() || "";
  const locationLine = formatLocation(provider.city, provider.state, provider.zip).trim();
  const hasAddress = Boolean(addressLine || locationLine);

  return (
    <HomeMotion>
      <section className="pt-6 pb-10 md:pt-7 md:pb-10">
      <Container>
        <nav className="mb-4" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            <li>
              <Link href="/" className="text-muted-foreground hover:text-primary">
                Home
              </Link>
            </li>
            <li className="text-muted-foreground/70">/</li>
            <li>
              <Link href="/find-a-professional" className="text-muted-foreground hover:text-primary">
                Find a professional
              </Link>
            </li>
            <li className="text-muted-foreground/70">/</li>
            <li className="font-medium">{provider.companyName}</li>
          </ol>
        </nav>

        <BookServiceProvider provider={provider} services={fixedServices}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex flex-col gap-8">
            {live?.portfolioLoading && !photos.length ? (
              <div className="overflow-hidden rounded-xl border border-input bg-card">
                <Skeleton className="h-[min(22rem,50svh)] w-full rounded-none md:h-[min(28rem,48svh)]" />
              </div>
            ) : photos.length ? (
              <PortfolioGallery photos={photos} companyName={provider.companyName} />
            ) : isLive ? (
              <p className="rounded-xl border border-dashed border-input bg-card px-4 py-16 text-center text-sm text-muted-foreground">
                Photos will appear here when this company adds a business gallery.
              </p>
            ) : null}

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <ProviderLogo provider={provider} size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold md:text-4xl">{provider.companyName}</h1>
                  <p className="mt-1 text-foreground">{provider.tagline}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Rating value={provider.rating} count={provider.reviewCount} size="md" />
                    <CredentialMark licensed={provider.licensed} insured={provider.insured} />
                    <span className="text-sm text-muted-foreground">
                      Business Verified
                    </span>
                  </div>
                </div>
              </div>
              {provider.description?.trim() ? (
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold">About</h2>
                  <p className="w-full text-base leading-7 text-foreground/80">
                    {provider.description}
                  </p>
                </div>
              ) : null}
            </div>

            <ProviderProjects
              provider={provider}
              projects={projects}
              keepVisible={isLive}
              onBeforeNavigate={live?.onProjectBeforeNavigate}
            />

            <FixedServiceCatalog
              provider={provider}
              services={live ? fixedServices : undefined}
            />

            <section className="flex flex-col gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">Service area</p>
                <h2 className="mt-1 text-2xl font-semibold">Where they work</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Based in {formatLocation(provider.city, provider.state)} and serving these areas.
              </p>
              <ServiceAreaMapLazy provider={provider} />
              <div className="flex flex-wrap gap-2">
                {areas.length ? (
                  areas.map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))
                ) : isLive ? (
                  <p className="text-sm text-muted-foreground">
                    Service area details will appear when coverage is published.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">Services</p>
                <h2 className="mt-1 text-2xl font-semibold">What they provide</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {categories.map((category) => (
                  <ServiceOfferCard key={category.id} category={category} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">Reviews</p>
                <h2 className="mt-1 text-2xl font-semibold">What customers say</h2>
              </div>
              <ProviderReviews
                reviews={provider.reviews}
                rating={provider.rating}
                reviewCount={provider.reviewCount}
              />
            </section>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Business information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4">
                {ownerName ? (
                  <BusinessInfoItem icon={UserRound} label="Owner">
                    <p>{ownerName}</p>
                    {ownerRole ? (
                      <p className="mt-0.5 font-normal text-muted-foreground">{ownerRole}</p>
                    ) : null}
                  </BusinessInfoItem>
                ) : null}
                {provider.phone?.trim() ? (
                  <BusinessInfoItem icon={Phone} label="Phone">
                    <a
                      href={`tel:${provider.phone.replace(/\s+/g, "")}`}
                      className="block break-words hover:text-primary"
                    >
                      {provider.phone}
                    </a>
                  </BusinessInfoItem>
                ) : null}
                {provider.email?.trim() ? (
                  <BusinessInfoItem icon={Mail} label="Email">
                    <a
                      href={`mailto:${provider.email}`}
                      className="block break-words hover:text-primary"
                    >
                      {provider.email}
                    </a>
                  </BusinessInfoItem>
                ) : null}
                {hasAddress ? (
                  <BusinessInfoItem icon={MapPin} label="Address">
                    {addressLine ? <p>{addressLine}</p> : null}
                    {locationLine ? (
                      <p className={cn("font-normal text-muted-foreground", addressLine && "mt-0.5")}>
                        {locationLine}
                      </p>
                    ) : null}
                  </BusinessInfoItem>
                ) : null}
                {website ? (
                  <BusinessInfoItem icon={Globe} label="Website">
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate hover:text-primary"
                    >
                      {displayWebsite(website)}
                    </a>
                  </BusinessInfoItem>
                ) : null}
                {provider.foundedYear > 0 ? (
                  <BusinessInfoItem icon={CalendarDays} label="Years in business">
                    <p>Since {provider.foundedYear}</p>
                    {yearsInBusiness > 0 ? (
                      <p className="mt-0.5 font-normal text-muted-foreground">
                        {yearsInBusiness}{" "}
                        {yearsInBusiness === 1 ? "Year" : "Years"} in business
                      </p>
                    ) : null}
                  </BusinessInfoItem>
                ) : yearsInBusiness > 0 ? (
                  <BusinessInfoItem icon={CalendarDays} label="Years in business">
                    <p>
                      {yearsInBusiness}{" "}
                      {yearsInBusiness === 1 ? "Year" : "Years"} in business
                    </p>
                  </BusinessInfoItem>
                ) : null}
                {provider.employeeCount?.trim() ? (
                  <BusinessInfoItem icon={Users} label="Team">
                    <p>{provider.employeeCount}</p>
                    <p className="mt-0.5 font-normal text-muted-foreground">
                      professionals
                    </p>
                  </BusinessInfoItem>
                ) : null}
                {paymentMethodsLabel ? (
                  <BusinessInfoItem icon={CreditCard} label="Payment methods">
                    <p>{paymentMethodsLabel}</p>
                  </BusinessInfoItem>
                ) : null}
                {languageLabel ? (
                  <BusinessInfoItem icon={Languages} label="Languages">
                    <p>{languageLabel}</p>
                  </BusinessInfoItem>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Get a written estimate</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4">
                <p className="text-sm text-muted-foreground">
                  New or custom work still goes through a written estimate. Priced fixed services
                  above book as a job immediately.
                </p>
                <Button size="xl" asChild>
                  <Link href={servicesForProviderHref(provider)}>Request a quote</Link>
                </Button>
                <ProviderChat provider={provider} />
                <BookServiceButton />
              </CardContent>
            </Card>

            {socials.length ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Visit us</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-wrap gap-2">
                    {socials.map((item) => (
                      <li key={item.id}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${item.label}`}
                          className="flex size-10 items-center justify-center rounded-lg border border-input bg-card transition-colors hover:border-primary/40 hover:bg-muted"
                        >
                          <span
                            className="size-4 bg-foreground"
                            style={{
                              maskImage: `url(${item.icon})`,
                              WebkitMaskImage: `url(${item.icon})`,
                              maskRepeat: "no-repeat",
                              maskPosition: "center",
                              maskSize: "contain",
                            }}
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {showHours ? (
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Working hours</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 text-sm">
                  {provider.workingHours.length ? (
                    provider.workingHours.map((hours) => (
                      <p
                        key={hours.day}
                        className={cn(
                          "flex items-baseline justify-between gap-3",
                          hours.day === today && "text-foreground"
                        )}
                      >
                        <span className="text-muted-foreground">{formatWorkingDay(hours.day)}</span>
                        <span className="font-medium tabular-nums">{formatHoursValue(hours)}</span>
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Hours not listed yet.</p>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </aside>
          </div>
        </BookServiceProvider>
        </Container>
      </section>

      {showRelated ? (
        <section className="pb-10 md:pb-14">
          <Container className="flex flex-col gap-4">
            <div>
              <p className="eyebrow text-muted-foreground">More professionals</p>
              <h2 className="mt-1 text-2xl font-semibold">Relevant Pros</h2>
            </div>
            {live?.relatedLoading ? (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
                aria-busy="true"
                aria-label="Loading related professionals"
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <ProviderCardSkeleton key={`related-sk-${i}`} />
                ))}
              </div>
            ) : relatedProviders.length ? (
              <div data-stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {relatedProviders.map((related) => (
                  <ProviderCard
                    key={related.id}
                    provider={related}
                    visual
                    place={place}
                    onBeforeNavigate={() => live?.onRelatedBeforeNavigate?.(related)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-input bg-card px-4 py-8 text-sm text-muted-foreground">
                Related professionals will appear here when matches are available.
              </p>
            )}
          </Container>
        </section>
      ) : null}

      <ProfileExplore columns={explore} />
    </HomeMotion>
  );
}

function BusinessInfoItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <div className="mt-0.5 text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}
