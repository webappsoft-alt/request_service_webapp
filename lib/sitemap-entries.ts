/**
 * Sitemap sections. `app/sitemap.xml` is the index; each section is served by
 * `app/sitemaps/sitemap.ts` at /sitemaps/sitemap/<id>.xml.
 * Large sections (locations) are split into chunks under Google's 50,000-URL limit.
 */

import type { MetadataRoute } from "next";
import { blogCategories, blogPosts } from "@/lib/data/blog";
import { getAllJobs } from "@/lib/data/jobs";
import { listLocationCities, listLocationStates } from "@/lib/data/locations";
import { proTrades } from "@/lib/data/pro-trades";
import { getAllProviderProjectParams } from "@/lib/data/provider-projects";
import { providers } from "@/lib/data/providers";
import { fetchPublicProfessionalsForSeo } from "@/lib/data/public-professional-seo";
import { serviceCategories } from "@/lib/data/services";
import { proPaths } from "@/lib/pro-paths";
import { publicPaths } from "@/lib/public-paths";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];
type ChangeFrequency = NonNullable<Entry["changeFrequency"]>;

const LOCATION_CHUNK_SIZE = 40_000;
/** Live Pros are paged from the API, 50 at a time. */
const MAX_LIVE_PRO_PAGES = 40;

function entry(path: string, priority: number, changeFrequency: ChangeFrequency = "weekly", lastModified = new Date()): Entry {
  return { url: absoluteUrl(path), lastModified, changeFrequency, priority };
}

function corePaths(): Entry[] {
  const staticRoutes = [
    "/",
    "/services",
    "/locations",
    "/find-a-professional",
    "/get-a-quote",
    "/request-service",
    "/about",
    "/how-it-works",
    "/blog",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
  ].map((path) => entry(path, path === "/" ? 1 : 0.8));

  return [
    ...staticRoutes,
    ...blogPosts.map((post) => entry(`/blog/${post.slug}`, 0.6, "monthly", new Date(post.updatedAt))),
    ...blogCategories.map((category) => entry(`/blog/category/${category.slug}`, 0.5)),
  ];
}

function servicePaths(): Entry[] {
  return [
    ...serviceCategories.map((category) => entry(publicPaths.service(category.slug), 0.9)),
    ...getAllJobs().map(({ category, slug }) => entry(publicPaths.subService(category.slug, slug), 0.8)),
  ];
}

function proLandingPaths(): Entry[] {
  return [
    entry(proPaths.home, 0.8),
    entry(proPaths.pricing, 0.8),
    entry(proPaths.join, 0.7),
    ...proTrades.map((trade) => entry(proPaths.trade(trade.slug), 0.7)),
    ...listLocationCities().map((city) => entry(proPaths.location(city.state.slug, city.slug), 0.5, "monthly")),
  ];
}

async function professionalPaths(): Promise<Entry[]> {
  const seen = new Set<string>();
  const entries: Entry[] = [];
  const add = (path: string, priority: number, changeFrequency: ChangeFrequency = "weekly") => {
    if (seen.has(path)) return;
    seen.add(path);
    entries.push(entry(path, priority, changeFrequency));
  };

  for (let page = 1; page <= MAX_LIVE_PRO_PAGES; page += 1) {
    const { items, hasNextPage } = await fetchPublicProfessionalsForSeo({ page, limit: 50, revalidate: 3600 });
    for (const pro of items) add(publicPaths.professional(pro.slug), 0.7);
    if (!hasNextPage) break;
  }
  for (const provider of providers) add(publicPaths.professional(provider.slug), 0.7);
  for (const { slug, project } of getAllProviderProjectParams()) {
    add(publicPaths.professionalProject(slug, project), 0.55, "monthly");
  }
  return entries;
}

function locationPaths(): Entry[] {
  const jobs = getAllJobs();
  const entries: Entry[] = [entry(publicPaths.locations, 0.8)];
  for (const state of listLocationStates()) entries.push(entry(publicPaths.locationState(state.slug), 0.7));
  for (const city of listLocationCities()) {
    const st = city.state.slug;
    entries.push(entry(publicPaths.locationCity(st, city.slug), 0.7));
    for (const category of serviceCategories) {
      entries.push(entry(publicPaths.locationService(st, city.slug, category.slug), 0.8));
    }
    for (const job of jobs) {
      entries.push(entry(publicPaths.locationSubService(st, city.slug, job.category.slug, job.slug), 0.6));
    }
  }
  return entries;
}

function locationChunkCount() {
  const cities = listLocationCities().length;
  const total = 1 + listLocationStates().length + cities * (1 + serviceCategories.length + getAllJobs().length);
  return Math.max(1, Math.ceil(total / LOCATION_CHUNK_SIZE));
}

export function sitemapIds(): string[] {
  return [
    "core",
    "services",
    "pros",
    "for-pros",
    ...Array.from({ length: locationChunkCount() }, (_, index) => `locations-${index}`),
  ];
}

export async function sitemapSection(id: string): Promise<MetadataRoute.Sitemap> {
  if (id === "core") return corePaths();
  if (id === "services") return servicePaths();
  if (id === "pros") return professionalPaths();
  if (id === "for-pros") return proLandingPaths();
  const chunk = /^locations-(\d+)$/.exec(id);
  if (chunk) {
    const start = Number(chunk[1]) * LOCATION_CHUNK_SIZE;
    return locationPaths().slice(start, start + LOCATION_CHUNK_SIZE);
  }
  return [];
}

export function sitemapSectionUrl(id: string) {
  return absoluteUrl(`/sitemaps/sitemap/${id}.xml`);
}
