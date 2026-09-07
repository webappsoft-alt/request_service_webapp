import type { MetadataRoute } from "next";
import { blogCategories, blogPosts } from "@/lib/data/blog";
import { getAllJobs } from "@/lib/data/jobs";
import { getAllProviderProjectParams } from "@/lib/data/provider-projects";
import { providers } from "@/lib/data/providers";
import { serviceCategories } from "@/lib/data/services";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/services",
    "/find-a-professional",
    "/get-a-quote",
    "/request-service",
    "/pro",
    "/about",
    "/how-it-works",
    "/blog",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
  ].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const serviceRoutes = serviceCategories.map((category) => ({
    url: absoluteUrl(`/services/${category.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const jobRoutes = getAllJobs().map(({ category, slug }) => ({
    url: absoluteUrl(`/services/${category.slug}/${slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const providerRoutes = providers.map((provider) => ({
    url: absoluteUrl(`/professionals/${provider.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const projectRoutes = getAllProviderProjectParams().map(({ slug, project }) => ({
    url: absoluteUrl(`/professionals/${slug}/projects/${project}`),
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const blogRoutes = blogPosts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const blogCategoryRoutes = blogCategories.map((category) => ({
    url: absoluteUrl(`/blog/category/${category.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...serviceRoutes,
    ...jobRoutes,
    ...providerRoutes,
    ...projectRoutes,
    ...blogRoutes,
    ...blogCategoryRoutes,
  ];
}
