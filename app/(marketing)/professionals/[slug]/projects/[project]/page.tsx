import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/marketplace/project-detail";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getAllProviderProjectParams,
  getProviderProject,
  getRelatedProviderProjects,
} from "@/lib/data/provider-projects";
import { getProviderBySlug } from "@/lib/data/providers";
import { breadcrumbJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
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
      title: "Project not found",
      description: "That portfolio project is not available.",
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
  const provider = getProviderBySlug(slug);
  if (!provider) notFound();
  const project = getProviderProject(provider, projectSlug);
  if (!project) notFound();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: project.title,
            description: project.summary,
            dateCreated: project.completedOn,
            image: project.images.map((src) => (src.startsWith("http") ? src : absoluteUrl(src))),
            creator: {
              "@type": "LocalBusiness",
              name: provider.companyName,
              url: absoluteUrl(`/professionals/${provider.slug}`),
            },
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Find a Professional", path: "/find-a-professional" },
            { name: provider.companyName, path: `/professionals/${provider.slug}` },
            {
              name: project.title,
              path: `/professionals/${provider.slug}/projects/${project.slug}`,
            },
          ]),
        ]}
      />
      <ProjectDetail
        provider={provider}
        project={project}
        related={getRelatedProviderProjects(provider, project.slug)}
      />
    </>
  );
}
