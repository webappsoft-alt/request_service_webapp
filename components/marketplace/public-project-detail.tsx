"use client";

import Link from "next/link";
import { ProjectDetail, portfolioToCard } from "@/components/marketplace/project-detail";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { useAppSelector } from "@/store/hooks";
import {
  publicProfessionalToProvider,
  selectPublicProfessionalBySlug,
} from "@/store/publicProfessionalsSlice";
import type { Provider, ProviderProject } from "@/lib/types";

export function PublicProjectDetailView({
  slug,
  projectSlug,
  seededProvider,
  seededProject,
  seededRelated = [],
}: {
  slug: string;
  projectSlug: string;
  seededProvider?: Provider | null;
  seededProject?: ProviderProject | null;
  seededRelated?: ProviderProject[];
}) {
  const providerSlug = String(slug || "").trim();
  const lookingFor = String(projectSlug || "").trim();

  const professional = useAppSelector((state) =>
    selectPublicProfessionalBySlug(state, providerSlug),
  );
  const stashedPortfolio = useAppSelector(
    (state) =>
      state.publicProfessionals.portfolioProjectsByProviderSlug[providerSlug] ??
      [],
  );

  const liveProvider = professional
    ? publicProfessionalToProvider(professional)
    : null;
  const provider = liveProvider ?? seededProvider ?? null;

  const portfolio =
    stashedPortfolio.find(
      (item) => item.slug === lookingFor || item.id === lookingFor,
    ) ?? null;

  const project = portfolio && provider
    ? portfolioToCard(portfolio, provider)
    : seededProject ?? null;

  const related =
    provider && portfolio
      ? stashedPortfolio
          .filter((item) => item.slug !== portfolio.slug && item.id !== portfolio.id)
          .slice(0, 3)
          .map((item) => portfolioToCard(item, provider))
      : seededRelated;

  if (!provider || !project) {
    return (
      <Container className="flex flex-col items-start gap-4 py-16">
        <p className="text-sm font-medium text-muted-foreground">Portfolio project</p>
        <h1 className="text-3xl font-semibold">Project not available</h1>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          Open this project from the professional&apos;s profile so we can show the
          portfolio details already loaded for that company.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/professionals/${providerSlug}`}>Back to profile</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/find-a-professional">Find a professional</Link>
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <ProjectDetail
      provider={provider}
      project={project}
      related={related}
      portfolio={portfolio}
    />
  );
}
