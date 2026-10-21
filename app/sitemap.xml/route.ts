import { sitemapIds, sitemapSectionUrl } from "@/lib/sitemap-entries";

export const revalidate = 3600;

/** Sitemap index: one child sitemap per section (see lib/sitemap-entries.ts). */
export function GET() {
  const lastmod = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapIds()
  .map((id) => `  <sitemap><loc>${sitemapSectionUrl(id)}</loc><lastmod>${lastmod}</lastmod></sitemap>`)
  .join("\n")}
</sitemapindex>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
