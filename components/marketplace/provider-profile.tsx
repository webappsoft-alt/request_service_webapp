import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Globe, Mail, MapPin, Phone, UserRound, Users, type LucideIcon } from "lucide-react";
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
  BookServiceCalendar,
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
import {
  displayWebsite,
  getProviderContact,
  getProviderWebsite,
} from "@/lib/data/provider-contact";
import { getProviderPhotos } from "@/lib/data/provider-media";
import { getProviderSocials } from "@/lib/data/provider-socials";
import { getProfileExplore, type ExplorePlace } from "@/lib/data/profile-explore";
import { getProviderProjects } from "@/lib/data/provider-projects";
import { getPortalServices } from "@/lib/data/portal";
import { getRelatedProviders } from "@/lib/data/providers";
import { getServiceAreaNames } from "@/lib/data/service-areas";
import { formatHoursValue, formatLocation, formatWorkingDay, getTodayWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Provider, ServiceCategory } from "@/lib/types";

export function ProviderProfile({
  provider,
  categories,
  place,
}: {
  provider: Provider;
  categories: ServiceCategory[];
  place?: ExplorePlace;
}) {
  const photos = getProviderPhotos(provider);
  const projects = getProviderProjects(provider);
  const relatedProviders = getRelatedProviders(provider);
  const explore = getProfileExplore(provider, categories, place);
  const areas = getServiceAreaNames(provider.serviceArea);
  const today = getTodayWeekday();
  const socials = getProviderSocials(provider);
  const contact = getProviderContact(provider);
  const website = getProviderWebsite(provider);
  const fixedServices = getPortalServices(provider).filter((item) => item.active);

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

        <div className="mb-4">
          <p className="eyebrow text-muted-foreground">Featured work</p>
          <h2 className="mt-1 text-2xl font-semibold">Recent photos</h2>
        </div>

        <BookServiceProvider slug={provider.slug} workingHours={provider.workingHours} services={fixedServices}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="flex flex-col gap-8">
            <PortfolioGallery photos={photos} companyName={provider.companyName} />

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
                      {provider.yearsInBusiness} years in business
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-semibold">About Service Pro</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground">
                  {provider.description}
                </p>
              </div>
            </div>

            <section className="flex flex-col gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">Services</p>
                <h2 className="mt-1 text-2xl font-semibold">What they provide</h2>
              </div>
              <div className="grid max-w-sm grid-cols-1 gap-3 sm:max-w-[38rem] sm:grid-cols-2">
                {categories.map((category) => (
                  <ServiceOfferCard key={category.id} category={category} />
                ))}
              </div>
            </section>

            <FixedServiceCatalog provider={provider} />

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
                {areas.map((area) => (
                  <Badge key={area} variant="outline">
                    {area}
                  </Badge>
                ))}
              </div>
            </section>

            <ProviderProjects provider={provider} projects={projects} />

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
                <BusinessInfoItem icon={UserRound} label="Owner">
                  <p>{contact.name}</p>
                  <p className="mt-0.5 font-normal text-muted-foreground">{contact.role}</p>
                </BusinessInfoItem>
                <BusinessInfoItem icon={Phone} label="Phone">
                  <a href={`tel:${provider.phone}`} className="hover:text-primary">
                    {provider.phone}
                  </a>
                </BusinessInfoItem>
                <BusinessInfoItem icon={Mail} label="Email">
                  <a
                    href={`mailto:${provider.email}`}
                    className="block break-words hover:text-primary"
                  >
                    {provider.email}
                  </a>
                </BusinessInfoItem>
                <BusinessInfoItem icon={MapPin} label="Address">
                  <p>{provider.street}</p>
                  <p className="mt-0.5 font-normal text-muted-foreground">
                    {formatLocation(provider.city, provider.state, provider.zip)}
                  </p>
                </BusinessInfoItem>
                <BusinessInfoItem icon={Globe} label="Website">
                  <a
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate hover:text-primary"
                  >
                    {displayWebsite(website)}
                  </a>
                </BusinessInfoItem>
                <BusinessInfoItem icon={CalendarDays} label="Founded">
                  <p>{provider.foundedYear}</p>
                  <p className="mt-0.5 font-normal text-muted-foreground">
                    {provider.yearsInBusiness}{" "}
                    {provider.yearsInBusiness === 1 ? "year" : "years"} ago
                  </p>
                </BusinessInfoItem>
                <BusinessInfoItem icon={Users} label="Team">
                  <p>{provider.employeeCount}</p>
                  <p className="mt-0.5 font-normal text-muted-foreground">people</p>
                </BusinessInfoItem>
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
                  <Link href={`/request-service?provider=${provider.slug}`}>Request a quote</Link>
                </Button>
                <ProviderChat provider={provider} />
                <BookServiceButton />
              </CardContent>
            </Card>

            <BookServiceCalendar />

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
                          aria-hidden="true"
                          className="size-4 bg-primary"
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

            <Card size="sm">
              <CardHeader>
                <CardTitle>Working hours</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 text-sm">
                {provider.workingHours.map((hours) => (
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
                ))}
              </CardContent>
            </Card>
          </aside>
          </div>
        </BookServiceProvider>
        </Container>
      </section>

      {relatedProviders.length ? (
        <section className="pb-10 md:pb-14">
          <Container className="flex flex-col gap-4">
            <div>
              <p className="eyebrow text-muted-foreground">More professionals</p>
              <h2 className="mt-1 text-2xl font-semibold">Relevant service providers</h2>
            </div>
            <div data-stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {relatedProviders.map((related) => (
                <ProviderCard key={related.id} provider={related} visual place={place} />
              ))}
            </div>
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
        <div className="mt-0.5 text-sm font-medium leading-5">{children}</div>
      </div>
    </div>
  );
}
