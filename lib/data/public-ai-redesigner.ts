import { aiRedesignerApi } from "@/components/api/ApiRoutesFile";
import type { RedesignCatalog } from "@/lib/api/ai-redesigner-client";

/**
 * AI designer catalog for server rendering (Kitchen & Bath Design page: hero before/after and the
 * styles showcase). Same public endpoint the designer loads on the client. Never throws: null on
 * failure, and the page falls back to its own image. Revalidates every 5 minutes, so admin changes
 * to styles or the showcase pair show up without a deploy.
 */
export async function fetchRedesignCatalogForSeo(): Promise<RedesignCatalog | null> {
  const base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/${aiRedesignerApi.catalog}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: RedesignCatalog } | RedesignCatalog;
    const catalog = body && typeof body === "object" && "data" in body ? body.data : (body as RedesignCatalog);
    return catalog && typeof catalog === "object" ? catalog : null;
  } catch {
    return null;
  }
}
