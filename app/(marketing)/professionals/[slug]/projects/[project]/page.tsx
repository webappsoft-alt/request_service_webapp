import { PublicProjectDetailView } from "@/components/marketplace/public-project-detail";
import {
  getAllProviderProjectParams,
  getProviderProject,
  getRelatedProviderProjects,
} from "@/lib/data/provider-projects";
import { getProviderBySlug } from "@/lib/data/providers";
import { buildMetadata } from "@/lib/seo";
import type { PageParams } from "@/lib/page-props";

export function generateStaticParams() {
  return getAllProviderProjectParams();
}

export async function generateMetadata({
  params,
}: PageParams<{ slug: string; project: string }>) {
  const { slug, project: projectSlug } = await params;
  const provider = getProviderBySlug(slug);
  const project = provider ? getProviderProject(provider, projectSlug) : undefined;
  if (!provider || !project) {
    return buildMetadata({
      title: "Portfolio project",
      description: "View this professional’s portfolio project.",
      path: `/professionals/${slug}/projects/${projectSlug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: `${project.title} | ${provider.companyName}`,
    description: project.summary,
    path: `/professionals/${provider.slug}/projects/${project.slug}`,
    keywords: [project.title, provider.companyName, project.categoryName, provider.city],
    images: [project.cover],
  });
}

export default async function ProviderProjectPage({
  params,
}: PageParams<{ slug: string; project: string }>) {
  const { slug, project: projectSlug } = await params;
  const seededProvider = getProviderBySlug(slug) ?? null;
  const seededProject = seededProvider
    ? getProviderProject(seededProvider, projectSlug) ?? null
    : null;
  const seededRelated =
    seededProvider && seededProject
      ? getRelatedProviderProjects(seededProvider, seededProject.slug)
      : [];

  return (
    <PublicProjectDetailView
      slug={slug}
      projectSlug={projectSlug}
      seededProvider={seededProvider}
      seededProject={seededProject}
      seededRelated={seededRelated}
    />
  );
}
