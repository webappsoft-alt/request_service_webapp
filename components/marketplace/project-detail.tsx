"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  MapPin,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { HomeMotion } from "@/components/home/home-motion";
import { ProviderProjectCard } from "@/components/marketplace/provider-projects";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { formatDate, formatMoney } from "@/lib/format";
import type { Provider, ProviderProject } from "@/lib/types";
import type { PortfolioProject } from "@/store/portfolioSlice";
import { cn } from "@/lib/utils";

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
    ? portfolio.media.filter((item) => item.url)
    : project.images.map((url, index) => ({
        url,
        type: "image" as const,
        caption: "",
        isBefore: false,
        isAfter: false,
        isCover: index === 0,
      }));
  const cover =
    media.find((item) => item.isCover)?.url ||
    media[0]?.url ||
    project.cover;
  const gallery = media.filter((item) => item.url !== cover);
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
  const aboutText =
    portfolio?.description?.trim() ||
    project.details.join("\n\n") ||
    project.summary;

  return (
    <HomeMotion>
      <article className="pt-6 pb-10 md:pt-7 md:pb-14">
        <Container className="flex flex-col gap-8">
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
              <li className="font-medium">{project.title}</li>
            </ol>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow text-muted-foreground">Portfolio project</p>
                  {portfolio?.isFeatured ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#003F7D]/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#003F7D] uppercase">
                      <Sparkles className="size-3" aria-hidden />
                      Featured
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
                  {portfolio?.title || project.title}
                </h1>
                {project.summary || portfolio?.description ? (
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                    {portfolio?.description || project.summary}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(portfolio?.categoryName || project.categoryName) ? (
                    <Badge variant="secondary">
                      {portfolio?.categoryName || project.categoryName}
                    </Badge>
                  ) : null}
                  {locationLabel ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {locationLabel}
                    </span>
                  ) : null}
                  {(portfolio?.projectDate || project.completedOn) ? (
                    <span className="text-sm text-muted-foreground">
                      Completed{" "}
                      {formatDate(portfolio?.projectDate || project.completedOn)}
                    </span>
                  ) : null}
                </div>
                {tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#f4f7fb] px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        <Tag className="size-3 text-muted-foreground" aria-hidden />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {(cost != null || duration) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {cost != null ? (
                    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-[#eef3f9] to-white p-4">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        <Wallet className="size-3.5" aria-hidden />
                        Project cost
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#003F7D]">
                        {formatMoney(cost)}
                      </p>
                    </div>
                  ) : null}
                  {duration ? (
                    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-[#eef3f9] to-white p-4">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        <Clock3 className="size-3.5" aria-hidden />
                        Duration
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {duration}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-input bg-muted">
                {cover ? (
                  <Image
                    src={cover}
                    alt={
                      media.find((item) => item.url === cover)?.caption ||
                      project.title
                    }
                    fill
                    priority
                    sizes="(min-width: 1280px) 48rem, 92vw"
                    className="object-cover"
                  />
                ) : null}
                {media.find((item) => item.url === cover)?.caption ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {media.find((item) => item.url === cover)?.caption}
                    </p>
                  </div>
                ) : null}
              </div>

              {gallery.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gallery.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="relative aspect-[4/3] overflow-hidden rounded-xl border border-input bg-muted"
                    >
                      <Image
                        src={item.url}
                        alt={item.caption || `${project.title} detail`}
                        fill
                        sizes="(min-width: 1024px) 14rem, 30vw"
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        {item.isBefore ? (
                          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
                            Before
                          </span>
                        ) : null}
                        {item.isAfter ? (
                          <span className="rounded-full bg-[#003F7D] px-2 py-0.5 text-[10px] font-semibold text-white uppercase">
                            After
                          </span>
                        ) : null}
                      </div>
                      {item.caption ? (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 py-2">
                          <p className="truncate text-xs font-medium text-white">
                            {item.caption}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {aboutText ? (
                <div className="flex flex-col gap-3">
                  <h2 className="text-2xl font-semibold">About this project</h2>
                  {aboutText.split(/\n+/).map((paragraph) => (
                    <p
                      key={paragraph}
                      className="max-w-2xl text-sm leading-7 text-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}

              {linkedServices.length ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="eyebrow text-muted-foreground">Linked services</p>
                    <h2 className="mt-1 text-2xl font-semibold">Fixed services on this job</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {linkedServices.map((service) => {
                      const href = `/request-service?provider=${provider.slug}&intent=book&serviceId=${service.id}`;
                      const body = (
                        <>
                          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                            {service.images?.[0] ? (
                              <Image
                                src={service.images[0]}
                                alt={service.name}
                                fill
                                sizes="(min-width: 1024px) 16rem, 45vw"
                                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                                No photo
                              </div>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-1 p-3.5">
                            <p className="font-semibold leading-snug">{service.name}</p>
                            {service.price != null ? (
                              <p className="text-sm text-[#003F7D]">
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
                        </>
                      );
                      return (
                        <Link
                          key={service.id}
                          href={href}
                          className={cn(
                            "group flex overflow-hidden rounded-2xl border border-black/10 bg-card transition-colors hover:border-black/25",
                          )}
                        >
                          <div className="flex w-full flex-col">{body}</div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <Button variant="outline" asChild className="w-fit">
                <Link href={`/professionals/${provider.slug}`}>
                  <ArrowLeft data-icon="inline-start" />
                  Back to {provider.companyName}
                </Link>
              </Button>
            </div>

            <aside className="flex flex-col gap-3 lg:sticky lg:top-24 lg:self-start">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Completed by</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-4">
                  <Link
                    href={`/professionals/${provider.slug}`}
                    className="flex items-center gap-3"
                  >
                    <ProviderLogo provider={provider} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{provider.companyName}</span>
                      <span className="block text-sm text-muted-foreground">
                        {provider.tagline}
                      </span>
                    </span>
                  </Link>
                  {(cost != null || duration || tags.length) ? (
                    <dl className="grid gap-2 rounded-xl bg-[#f4f7fb] p-3 text-sm">
                      {cost != null ? (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Cost</dt>
                          <dd className="font-medium">{formatMoney(cost)}</dd>
                        </div>
                      ) : null}
                      {duration ? (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Duration</dt>
                          <dd className="font-medium text-right">{duration}</dd>
                        </div>
                      ) : null}
                      {locationLabel ? (
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">Location</dt>
                          <dd className="font-medium text-right">{locationLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                  <Button size="xl" asChild>
                    <Link href={`/request-service?provider=${provider.slug}`}>
                      Request this pro
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="xl" asChild>
                    <Link href={`/professionals/${provider.slug}`}>View full profile</Link>
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>

          {related.length ? (
            <section className="flex flex-col gap-4 border-t pt-8">
              <div>
                <p className="eyebrow text-muted-foreground">More from this pro</p>
                <h2 className="mt-1 text-2xl font-semibold">Other projects</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <ProviderProjectCard key={item.slug} provider={provider} project={item} />
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
