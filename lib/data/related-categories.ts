import { getServiceCategoryBySlug, serviceCategories } from "@/lib/data/services";
import type { ServiceCategory, ServiceCategorySlug } from "@/lib/types";

const relatedBySlug: Record<ServiceCategorySlug, ServiceCategorySlug[]> = {
  plumbing: ["hvac", "electrical", "bathroom-remodeling", "handyman"],
  hvac: ["plumbing", "electrical", "handyman"],
  electrical: ["hvac", "handyman", "bathroom-remodeling"],
  handyman: ["plumbing", "electrical", "painting", "bathroom-remodeling"],
  "house-cleaning": ["pest-control", "painting", "handyman"],
  roofing: ["handyman", "landscaping", "hvac"],
  landscaping: ["pest-control", "handyman", "roofing"],
  painting: ["bathroom-remodeling", "house-cleaning", "handyman"],
  "bathroom-remodeling": ["plumbing", "electrical", "painting", "handyman"],
  "pest-control": ["house-cleaning", "landscaping"],
};

export function getRelatedCategories(slug?: ServiceCategorySlug): ServiceCategory[] {
  if (!slug) return serviceCategories;
  return relatedBySlug[slug]
    .map((item) => getServiceCategoryBySlug(item))
    .filter((item): item is ServiceCategory => Boolean(item));
}

export function directoryHref(
  path: string,
  extras: { service?: string; job?: string; zip?: string; loc?: string },
) {
  const params = new URLSearchParams();
  if (extras.service) params.set("service", extras.service);
  if (extras.job) params.set("job", extras.job);
  if (extras.zip) params.set("zip", extras.zip);
  if (extras.loc && extras.loc !== extras.zip) params.set("loc", extras.loc);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
