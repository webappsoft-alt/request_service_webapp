import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { HomeMotion } from "@/components/home/home-motion";
import { ProviderProjectCard } from "@/components/marketplace/provider-projects";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { formatDate } from "@/lib/format";
import type { Provider, ProviderProject } from "@/lib/types";

export function ProjectDetail({
  provider,
  project,
  related,
}: {
  provider: Provider;
  project: ProviderProject;
  related: ProviderProject[];
}) {
  const extraImages = project.images.slice(1);

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
                <p className="eyebrow text-muted-foreground">Portfolio project</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{project.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  {project.summary}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{project.categoryName}</Badge>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {project.location}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Completed {formatDate(project.completedOn)}
                  </span>
                </div>
              </div>

              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-input bg-muted">
                <Image
                  src={project.cover}
                  alt={project.title}
                  fill
                  priority
                  sizes="(min-width: 1280px) 48rem, 92vw"
                  className="object-cover"
                />
              </div>

              {extraImages.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {extraImages.map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      className="relative aspect-[4/3] overflow-hidden rounded-xl border border-input bg-muted"
                    >
                      <Image
                        src={src}
                        alt={`${project.title} detail`}
                        fill
                        sizes="(min-width: 1024px) 14rem, 30vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold">About this project</h2>
                {project.details.map((paragraph) => (
                  <p key={paragraph} className="max-w-2xl text-sm leading-7 text-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>

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
                      <span className="block text-sm text-muted-foreground">{provider.tagline}</span>
                    </span>
                  </Link>
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
