import type { MetadataRoute } from "next";
import { sitemapIds, sitemapSection } from "@/lib/sitemap-entries";

export const revalidate = 3600;

export async function generateSitemaps() {
  return sitemapIds().map((id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  return sitemapSection(await props.id);
}
