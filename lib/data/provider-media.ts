import { getAreaName } from "@/lib/data/service-areas";
import { getServiceCategoryById } from "@/lib/data/services";
import type { Provider } from "@/lib/types";

const basePriceByCategory: Record<string, number> = {
  cat_plumbing: 119,
  cat_hvac: 149,
  cat_electrical: 129,
  cat_handyman: 89,
  cat_house_cleaning: 119,
  cat_roofing: 249,
  cat_landscaping: 139,
  cat_painting: 199,
  cat_bathroom_remodeling: 649,
  cat_pest_control: 99,
};

const relatedImagesByCategory: Record<string, string[]> = {
  cat_plumbing: [
    "/images/services/service-plumbing.jpg",
    "/images/services/service-bathroom.jpg",
    "/images/home/hero-home.jpg",
    "/images/home/step-compare.jpg",
  ],
  cat_hvac: [
    "/images/services/service-hvac.jpg",
    "/images/home/step-compare.jpg",
    "/images/home/split-homeowner.jpg",
    "/images/home/hero-home.jpg",
  ],
  cat_electrical: [
    "/images/services/service-electrical.jpg",
    "/images/home/step-search.jpg",
    "/images/home/hero-home.jpg",
    "/images/home/step-hire.jpg",
  ],
  cat_handyman: [
    "/images/services/service-handyman.jpg",
    "/images/home/step-hire.jpg",
    "/images/home/step-search.jpg",
    "/images/services/service-painting.jpg",
  ],
  cat_house_cleaning: [
    "/images/services/service-cleaning.jpg",
    "/images/home/split-homeowner.jpg",
    "/images/home/hero-home.jpg",
    "/images/home/step-compare.jpg",
  ],
  cat_roofing: [
    "/images/services/service-roofing.jpg",
    "/images/home/step-compare.jpg",
    "/images/home/split-provider.jpg",
    "/images/home/hero-home.jpg",
  ],
  cat_landscaping: [
    "/images/services/service-landscaping.jpg",
    "/images/home/split-provider.jpg",
    "/images/home/step-hire.jpg",
    "/images/services/service-painting.jpg",
  ],
  cat_painting: [
    "/images/services/service-painting.jpg",
    "/images/home/step-hire.jpg",
    "/images/home/split-homeowner.jpg",
    "/images/services/service-bathroom.jpg",
  ],
  cat_bathroom_remodeling: [
    "/images/services/service-bathroom.jpg",
    "/images/services/service-plumbing.jpg",
    "/images/home/hero-home.jpg",
    "/images/home/step-compare.jpg",
  ],
  cat_pest_control: [
    "/images/services/service-pest.jpg",
    "/images/home/step-search.jpg",
    "/images/home/split-provider.jpg",
    "/images/services/service-landscaping.jpg",
  ],
};

export function getCategoryStartingPrice(categoryId: string) {
  return basePriceByCategory[categoryId] ?? 99;
}

export function getServiceImagePool(categoryId: string) {
  const category = getServiceCategoryById(categoryId);
  return [...new Set([category?.image, ...(relatedImagesByCategory[categoryId] ?? [])])].filter(
    (src): src is string => Boolean(src),
  );
}

export function getJobImage(categoryId: string, job: string, index?: number) {
  const pool = getServiceImagePool(categoryId);
  if (!pool.length) return undefined;
  if (typeof index === "number") return pool[index % pool.length];

  let hash = 0;
  for (const char of job) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

export function getJobStartingPrice(categoryId: string, job: string) {
  const base = getCategoryStartingPrice(categoryId);
  let hash = 0;
  for (const char of job) hash = (hash + char.charCodeAt(0)) % 17;
  const bump = [0, 20, 40, -20, 60, 10, 30, -10][hash % 8];
  return Math.max(49, base + bump);
}

export function getStartingPrice(provider: Provider) {
  if (provider.startingPrice) return provider.startingPrice;
  const prices = provider.categoryIds
    .map((id) => basePriceByCategory[id])
    .filter((value): value is number => Boolean(value));
  return prices.length ? Math.min(...prices) : 99;
}

export function getProviderPhotos(provider: Provider) {
  const categoryImages = provider.categoryIds
    .flatMap((id) => {
      const category = getServiceCategoryById(id);
      return [category?.image, ...(relatedImagesByCategory[id] ?? [])];
    })
    .filter((src): src is string => Boolean(src));

  const unique = [
    ...new Set([provider.coverImage, ...(provider.images ?? []), ...categoryImages]),
  ].filter((src): src is string => Boolean(src));

  return unique.slice(0, 8).map((src, index) => ({
    src,
    alt: provider.gallery[index] ?? `${provider.companyName} project ${index + 1}`,
  }));
}

export function getServiceAreaPoints(provider: Provider) {
  return provider.serviceArea.map((zip, index) => {
    const angle = (index / Math.max(provider.serviceArea.length, 1)) * Math.PI * 2;
    const radius = 0.016 + (index % 3) * 0.007;
    return {
      zip,
      name: getAreaName(zip),
      lat: provider.lat + Math.sin(angle) * radius,
      lng: provider.lng + Math.cos(angle) * radius,
    };
  });
}
