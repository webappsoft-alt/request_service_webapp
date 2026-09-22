"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { HomeMotion } from "@/components/home/home-motion";
import { ProjectPortfolioGallery } from "@/components/marketplace/project-portfolio-gallery";
import { ProviderProjectCard } from "@/components/marketplace/provider-projects";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { formatDate, formatMoney } from "@/lib/format";
import type { Provider, ProviderProject } from "@/lib/types";
import type { PortfolioProject } from "@/store/portfolioSlice";

function portfolioToCard(project: PortfolioProject, provider: Provider): ProviderProject {
  const images = project.media
    .filter((item) => item.type === "image" && item.url)
    .map((item) => item.url);
  const cover =
    project.media.find((item) => item.isCover && item.url)?.url ||
    images[0] ||
    "";
  return {
    slug: project.slug || project.id,
    title: project.title || "Project",
    summary: project.description || "",
    location: provider.city
      ? `${provider.city}${provider.zip ? `, ${provider.zip}` : provider.state ? `, ${provider.state}` : ""}`
      : provider.companyName,
    completedOn: project.projectDate || project.createdAt || "",
    categoryName: project.categoryName || "Project",
    cover,
    images,
    details: project.description ? [project.description] : [],
  };
}

export function ProjectDetail({
  provider,
  project,
  related,
  portfolio,
}: {
  provider: Provider;
  project: ProviderProject;
  related: ProviderProject[];
  /** Full public portfolio record from profile state (preferred). */
  portfolio?: PortfolioProject | null;
}) {
  const media = portfolio?.media?.length
    ? portfolio.media.filter((item) => item.url && item.type !== "video")
    : project.images.map((url, index) => ({
        url,
        type: "image" as const,
        caption: "",
        isBefore: false,
        isAfter: false,
        isCover: index === 0,
      }));
  const title = portfolio?.title || project.title;
  const cover =
    media.find((item) => item.isCover)?.url ||
    media[0]?.url ||
    project.cover;
  const photos = [
    ...media.filter((item) => item.url === cover),
    ...media.filter((item) => item.url && item.url !== cover),
  ].map((item, index) => ({
    src: item.url,
    alt:
      item.caption ||
      (item.isBefore
        ? `${title} before`
        : item.isAfter
          ? `${title} after`
          : title),
    label:
      index === 0 && portfolio?.isFeatured
        ? "Featured"
        : item.isBefore
          ? "Before"
          : item.isAfter
            ? "After"
            : undefined,
  }));
  const tags = portfolio?.tags?.filter(Boolean) ?? [];
  const linkedServices = portfolio?.linkedServices ?? [];
  const duration = portfolio?.duration?.trim() || "";
  const cost =
    typeof portfolio?.cost === "number" && portfolio.cost > 0
      ? portfolio.cost
      : null;
  const locationLabel =
    project.location ||
    [provider.city, provider.zip || provider.state].filter(Boolean).join(", ");
  const categoryName = portfolio?.categoryName || project.categoryName;
  const completedOn = portfolio?.projectDate || project.completedOn;
  const aboutText =
    portfolio?.description?.trim() ||
    project.details.join("\n\n") ||
    project.summary;
  const hasFacts = cost != null || Boolean(duration) || Boolean(locationLabel);
  const hasDetails =
    Boolean(aboutText) ||
    tags.length > 0 ||
    linkedServices.length > 0 ||
    hasFacts;

  return (
    <HomeMotion>
      <article className="pt-6 pb-10 md:pt-7 md:pb-14">
        <Container className="flex flex-col gap-5">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary">
                  Home
                </Link>
              </li>
              <li className="text-muted-foreground/70">/</li>
              <li>
                <Link
                  href="/find-a-professional"
                  className="text-muted-foreground hover:text-primary"
                >
                  Find a professional
                </Link>
              </li>
              <li className="text-muted-foreground/70">/</li>
              <li>
                <Link
                  href={`/professionals/${provider.slug}`}
                  className="text-muted-foreground hover:text-primary"
                >
                  {provider.companyName}
                </Link>
              </li>
              <li className="text-muted-foreground/70">/</li>
              <li className="line-clamp-1 font-medium">{title}</li>
            </ol>
          </nav>

          <ProjectPortfolioGallery photos={photos} title={title} />

          <header className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {categoryName ? <span>{categoryName}</span> : null}
              {categoryName && locationLabel ? (
                <span className="text-muted-foreground/50">·</span>
              ) : null}
              {locationLabel ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {locationLabel}
                </span>
              ) : null}
              {(categoryName || locationLabel) && completedOn ? (
                <span className="text-muted-foreground/50">·</span>
              ) : null}
              {completedOn ? <span>{formatDate(completedOn)}</span> : null}
            </p>
          </header>

          {hasDetails ? (
            <div className="mt-3 grid gap-8 border-t border-black/10 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <div className="flex flex-col gap-8">
                {aboutText ? (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold">About this project</h2>
                    <div className="flex flex-col gap-3">
                      {aboutText.split(/\n+/).map((paragraph) => (
                        <p
                          key={paragraph}
                          className="max-w-3xl text-sm leading-7 text-muted-foreground"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {linkedServices.length ? (
                  <section className="flex flex-col gap-3">
                    <h2 className="text-xl font-semibold">Services on this job</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {linkedServices.map((service) => {
                        const href = `/request-service?provider=${provider.slug}&intent=book&serviceId=${service.id}`;
                        return (
                          <Link
                            key={service.id}
                            href={href}
                            className="group overflow-hidden rounded-xl border border-black/10 bg-card transition-colors hover:border-black/25"
                          >
                            <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                              {service.images?.[0] ? (
                                <Image
                                  src={service.images[0]}
                                  alt={service.name}
                                  fill
                                  sizes="(min-width: 1024px) 16rem, 45vw"
                                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                  unoptimized={service.images[0].startsWith("http")}
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                                  No photo
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 p-3.5">
                              <p className="font-semibold leading-snug">{service.name}</p>
                              {service.price != null ? (
                                <p className="text-sm text-primary">
                                  {formatMoney(service.price)}
                                  {service.unit ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {service.unit}
                                    </span>
                                  ) : null}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <Button variant="outline" asChild className="w-fit">
                  <Link href={`/professionals/${provider.slug}`}>
                    <ArrowLeft data-icon="inline-start" />
                    Back to {provider.companyName}
                  </Link>
                </Button>
              </div>

              <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
                <Card className="border-black/15 shadow-none">
                  <CardHeader className="border-b border-black/10 pb-4">
                    <CardTitle className="text-base">Completed by</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 pt-4">
                    <Link
                      href={`/professionals/${provider.slug}`}
                      className="flex items-center gap-3 rounded-lg transition-colors hover:bg-muted/60"
                    >
                      <ProviderLogo provider={provider} size="md" />
                      <span className="min-w-0">
                        <span className="block font-semibold leading-snug">
                          {provider.companyName}
                        </span>
                        {provider.tagline ? (
                          <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">
                            {provider.tagline}
                          </span>
                        ) : null}
                      </span>
                    </Link>

                    {hasFacts ? (
                      <dl className="divide-y divide-black/10 rounded-xl border border-black/10 text-sm">
                        {cost != null ? (
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <dt className="text-muted-foreground">Cost</dt>
                            <dd className="font-medium tabular-nums">
                              {formatMoney(cost)}
                            </dd>
                          </div>
                        ) : null}
                        {duration ? (
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <dt className="text-muted-foreground">Duration</dt>
                            <dd className="text-right font-medium">{duration}</dd>
                          </div>
                        ) : null}
                        {locationLabel ? (
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <dt className="text-muted-foreground">Location</dt>
                            <dd className="max-w-[60%] text-right font-medium">
                              {locationLabel}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      <Button size="xl" asChild className="w-full">
                        <Link href={`/request-service?provider=${provider.slug}`}>
                          Request this pro
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="xl" asChild className="w-full">
                        <Link href={`/professionals/${provider.slug}`}>
                          View full profile
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : (
            <Button variant="outline" asChild className="w-fit">
              <Link href={`/professionals/${provider.slug}`}>
                <ArrowLeft data-icon="inline-start" />
                Back to {provider.companyName}
              </Link>
            </Button>
          )}

          {related.length ? (
            <section className="flex flex-col gap-4 border-t border-black/10 pt-8">
              <h2 className="text-xl font-semibold">Other projects</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <ProviderProjectCard
                    key={item.slug}
                    provider={provider}
                    project={item}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </article>
    </HomeMotion>
  );
}

export { portfolioToCard };
