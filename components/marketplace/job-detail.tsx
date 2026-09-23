import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { HomeMotion } from "@/components/home/home-motion";
import { Container, Section } from "@/components/layout/container";
import {
  ServiceJobCard,
  type ServiceJobListing,
} from "@/components/marketplace/service-job-card";
import { PortfolioGallery } from "@/components/marketplace/portfolio-lightbox";
import { JobDetailFaqSection } from "@/components/marketplace/job-detail-faq-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/shared/provider-card";
import {
  ProviderCardSkeleton,
  ServiceJobCardSkeleton,
} from "@/components/shared/loading-skeletons";
import { getJobImage, getJobStartingPrice } from "@/lib/data/provider-media";
import { getRelatedJobs, type JobRecord } from "@/lib/data/jobs";
import { formatStartingPrice } from "@/lib/format";
import type { Provider } from "@/lib/types";

/** Optional live Fixed Service overrides — same layout, API-backed values. */
export type JobDetailContent = {
  price: number;
  imageUrl?: string;
  /** When multiple images exist, the gallery slider is used. */
  imageUrls?: string[];
  description?: string;
  points?: string[];
  tagline?: string;
  benefits?: string[];
  /** Hide static “related jobs” when showing a live Fixed Service. */
  hideRelated?: boolean;
  requestHref?: string;
  /** When set, Request this job runs this handler instead of navigating. */
  onRequestJob?: () => void;
  /** Override primary CTA label (e.g. "View order" when already booked). */
  requestLabel?: string;
  /** Short note under the CTA (e.g. already-booked status). */
  requestHint?: string;
  compareHref?: string;
};

export function JobDetail({
  record,
  providers,
  content,
  relatedListings,
  relatedLoading = false,
  providersLoading = false,
}: {
  record: JobRecord;
  providers: Provider[];
  content?: JobDetailContent;
  /** Live related fixed services from `GET /public/fixed-services/related`. */
  relatedListings?: ServiceJobListing[];
  /** Show Related jobs section spinner while related APIs load. */
  relatedLoading?: boolean;
  /** Show Companies section spinner while professionals APIs load. */
  providersLoading?: boolean;
}) {
  const { category, job, index, detail } = record;
  const price = content?.price ?? getJobStartingPrice(category.id, job);
  const fallbackImage = content?.imageUrl || getJobImage(category.id, job, index);
  const galleryImages =
    content?.imageUrls?.filter(Boolean).length
      ? content.imageUrls.filter(Boolean)
      : fallbackImage
        ? [fallbackImage]
        : [];
  const galleryPhotos = galleryImages.map((src, index) => ({
    src,
    alt:
      index === 0
        ? `${job} gallery`
        : `${job} photo ${index + 1}`,
  }));
  const staticRelated =
    relatedListings || relatedLoading || content?.hideRelated
      ? []
      : getRelatedJobs(category, job);
  const requestHref =
    content?.requestHref ??
    `/get-a-quote?service=${category.slug}&job=${record.slug}`;
  const onRequestJob = content?.onRequestJob;
  const requestLabel = content?.requestLabel?.trim() || "Request this job";
  const requestHint = content?.requestHint?.trim() || "";
  const compareHref =
    content?.compareHref ??
    `/find-a-professional?service=${category.slug}`;
  const description =
    content?.description ??
    `${detail.description} This is typical ${category.name.toLowerCase()} work, not a company listing. The written estimate comes after a visit.`;
  const points = content?.points?.length ? content.points : detail.points;
  const tagline = content?.tagline ?? category.tagline;
  const benefits = content?.benefits?.length
    ? content.benefits
    : category.benefits.slice(0, 4);
  const showRelatedListings = Boolean(relatedListings?.length);
  const showStaticRelated = !relatedListings && !relatedLoading && staticRelated.length > 0;
  const showRelatedSection =
    relatedLoading || showRelatedListings || showStaticRelated;
  const showProvidersSection = providersLoading || providers.length > 0;

  return (
    <HomeMotion>
      <section className="pt-6 pb-10 md:pt-7 md:pb-12">
        <Container className="flex flex-col gap-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground transition-colors hover:text-primary">
                  Home
                </Link>
              </li>
              <li className="text-muted-foreground/70" aria-hidden="true">
                /
              </li>
              <li>
                <Link
                  href="/services"
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  Services
                </Link>
              </li>
              <li className="text-muted-foreground/70" aria-hidden="true">
                /
              </li>
              <li>
                <Link
                  href={`/services/${category.slug}`}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  {category.name}
                </Link>
              </li>
              <li className="text-muted-foreground/70" aria-hidden="true">
                /
              </li>
              <li className="font-medium text-foreground" aria-current="page">
                {job}
              </li>
            </ol>
          </nav>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,22rem)] lg:gap-12">
            <div className="flex flex-col gap-6">
              {galleryPhotos.length ? (
                <PortfolioGallery photos={galleryPhotos} companyName={job} />
              ) : null}

              <div className="flex flex-col gap-3">
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  {description}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">What this job usually includes</h2>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm leading-6">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">How it works</h2>
                <ul className="flex flex-col gap-2.5">
                  {[
                    "Send a booking request with your ZIP and a short description.",
                    "Local licensed pros review the job and send a written estimate.",
                    "Compare the estimates, then hire only if you want to move forward.",
                  ].map((step) => (
                    <li key={step} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <JobDetailFaqSection />
            </div>

            <aside className="rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-24">
              <Badge variant="secondary">{category.shortName}</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{job}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground capitalize">{tagline}</p>

              <p className="mt-5">
                <span className="block text-[11px] text-muted-foreground">Typical starting price</span>
                <span className="block text-3xl font-semibold tracking-tight text-brand tabular-nums">
                  {formatStartingPrice(price)}
                </span>
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                {onRequestJob ? (
                  <Button size="xl" type="button" onClick={onRequestJob}>
                    {requestLabel}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                ) : (
                  <Button size="xl" asChild>
                    <Link href={requestHref}>
                      {requestLabel}
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                )}
                {requestHint ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {requestHint}
                  </p>
                ) : null}
                <Button size="xl" variant="outline" asChild>
                  <Link href={compareHref}>Compare local pros</Link>
                </Button>
              </div>

              <ul className="mt-5 flex flex-col gap-2 border-t pt-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Container>
      </section>

      {showRelatedSection ? (
        <Section tone="muted" density="tight">
          <Container className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-muted-foreground">{category.name}</p>
              <h2 className="text-2xl font-semibold">Related jobs</h2>
            </div>
            {relatedLoading ? (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
                aria-busy="true"
                aria-label="Loading related jobs"
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <ServiceJobCardSkeleton key={`related-job-sk-${i}`} />
                ))}
              </div>
            ) : showRelatedListings ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {relatedListings!.map((listing, relatedIndex) => (
                  <ServiceJobCard
                    key={listing.id}
                    category={category}
                    job={listing.title}
                    index={relatedIndex}
                    listing={listing}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {staticRelated.map((item, relatedIndex) => (
                  <ServiceJobCard
                    key={item}
                    category={category}
                    job={item}
                    index={relatedIndex}
                  />
                ))}
              </div>
            )}
          </Container>
        </Section>
      ) : null}

      {showProvidersSection ? (
        <Section density="tight">
          <Container className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="eyebrow text-muted-foreground">Companies</p>
                <h2 className="text-2xl font-semibold">{category.name} professionals</h2>
              </div>
              <Link
                href={compareHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-foreground"
              >
                Open {category.shortName} listings
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            {providersLoading ? (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
                aria-busy="true"
                aria-label="Loading professionals"
              >
                {Array.from({ length: 4 }, (_, i) => (
                  <ProviderCardSkeleton key={`pro-sk-${i}`} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {providers.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} visual />
                ))}
              </div>
            )}
          </Container>
        </Section>
      ) : null}
    </HomeMotion>
  );
}
