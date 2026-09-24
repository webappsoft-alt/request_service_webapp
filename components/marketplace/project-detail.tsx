"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { HomeMotion } from "@/components/home/home-motion";
import { ProjectPortfolioGallery } from "@/components/marketplace/project-portfolio-gallery";
import { ProviderProjectCard } from "@/components/marketplace/provider-projects";
import { ProviderLogo } from "@/components/shared/provider-logo";
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
    categoryName: project.categoryName || "",
    subcategoryName: project.subcategoryName || "",
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
  ].map((item) => ({
    src: item.url,
    alt: title,
  }));
  const categoryName = portfolio?.categoryName || project.categoryName || "";
  const subcategoryName =
    portfolio?.subcategoryName || project.subcategoryName || "";
  const aboutText =
    portfolio?.description?.trim() ||
    project.details.join("\n\n") ||
    project.summary;
  const metaLine = [categoryName, subcategoryName].filter(Boolean).join(" · ");

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

          <div className="mt-1 grid gap-8 border-t border-black/10 pt-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="flex flex-col gap-6">
              <header className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {title}
                </h1>
                {metaLine ? (
                  <p className="text-sm text-muted-foreground">{metaLine}</p>
                ) : null}
              </header>

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

                  {(categoryName || subcategoryName) && (
                    <dl className="divide-y divide-black/10 rounded-xl border border-black/10 text-sm">
                      {categoryName ? (
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                          <dt className="text-muted-foreground">Category</dt>
                          <dd className="text-right font-medium">{categoryName}</dd>
                        </div>
                      ) : null}
                      {subcategoryName ? (
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                          <dt className="text-muted-foreground">Subcategory</dt>
                          <dd className="max-w-[60%] text-right font-medium">
                            {subcategoryName}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  )}

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
