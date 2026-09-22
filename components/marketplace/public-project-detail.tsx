"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProjectDetail, portfolioToCard } from "@/components/marketplace/project-detail";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPublicProfessionalBySlug,
  publicProfessionalToProvider,
  selectPublicProfessionalBySlug,
  setPublicPortfolioProjects,
} from "@/store/publicProfessionalsSlice";
import {
  normalizePortfolioProject,
  type PortfolioProject,
} from "@/store/portfolioSlice";
import type { Provider, ProviderProject } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractPortfolioProjects(response: unknown): PortfolioProject[] {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);
  const rawList: unknown[] =
    (Array.isArray(root.data) && root.data) ||
    (nested && Array.isArray(nested.data) && nested.data) ||
    (Array.isArray(root.projects) && root.projects) ||
    [];

  return rawList
    .map(normalizePortfolioProject)
    .filter((item): item is PortfolioProject => Boolean(item));
}

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
  const dispatch = useAppDispatch();
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
  const [fetchedProjects, setFetchedProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(!stashedPortfolio.length);

  const portfolioList = stashedPortfolio.length ? stashedPortfolio : fetchedProjects;

  useEffect(() => {
    if (!providerSlug) return;
    if (!professional) {
      void dispatch(fetchPublicProfessionalBySlug(providerSlug));
    }
  }, [dispatch, professional, providerSlug]);

  useEffect(() => {
    if (!providerSlug) return;
    if (stashedPortfolio.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function loadPortfolio() {
      try {
        const response = await getData(
          publicApi.professionalPortfolio(providerSlug),
          { page: 1, limit: 12 },
          { silent: true },
        );
        if (cancelled) return;
        const projects = extractPortfolioProjects(response);
        setFetchedProjects(projects);
        if (projects.length) {
          dispatch(
            setPublicPortfolioProjects({
              providerSlug,
              projects,
            }),
          );
        }
      } catch {
        if (!cancelled) setFetchedProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPortfolio();
    return () => {
      cancelled = true;
    };
  }, [dispatch, providerSlug, stashedPortfolio.length]);

  const liveProvider = professional
    ? publicProfessionalToProvider(professional)
    : null;
  const provider = liveProvider ?? seededProvider ?? null;

  const portfolio =
    portfolioList.find(
      (item) => item.slug === lookingFor || item.id === lookingFor,
    ) ?? null;

  const project = portfolio && provider
    ? portfolioToCard(portfolio, provider)
    : seededProject ?? null;

  const related =
    provider && portfolio
      ? portfolioList
          .filter((item) => item.slug !== portfolio.slug && item.id !== portfolio.id)
          .slice(0, 3)
          .map((item) => portfolioToCard(item, provider))
      : seededRelated;

  if (loading && !project) {
    return (
      <Container className="py-16">
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </Container>
    );
  }

  if (!provider || !project) {
    return (
      <Container className="flex flex-col items-start gap-4 py-16">
        <p className="text-sm font-medium text-muted-foreground">Portfolio project</p>
        <h1 className="text-3xl font-semibold">Project not available</h1>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          This project could not be loaded. Open the professional&apos;s profile
          and try again.
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
