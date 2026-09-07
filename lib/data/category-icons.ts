import type { ServiceCategorySlug } from "@/lib/types";

const categoryIcons: Record<ServiceCategorySlug, string> = {
  plumbing: "/icons/categories/plumbing.svg",
  hvac: "/icons/categories/hvac.svg",
  electrical: "/icons/categories/electrical.svg",
  handyman: "/icons/categories/handyman.svg",
  "house-cleaning": "/icons/categories/house-cleaning.svg",
  roofing: "/icons/categories/roofing.svg",
  landscaping: "/icons/categories/landscaping.svg",
  painting: "/icons/categories/painting.svg",
  "bathroom-remodeling": "/icons/categories/bathroom-remodeling.svg",
  "pest-control": "/icons/categories/pest-control.svg",
};

export function getCategoryIconSrc(slug: string) {
  return categoryIcons[slug as ServiceCategorySlug] ?? categoryIcons.handyman;
}
