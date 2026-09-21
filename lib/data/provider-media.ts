import { galleryBanner, normalizeBusinessGallery } from "@/lib/business-gallery";
import { getAreaName } from "@/lib/data/service-areas";
import { getServiceCategoryById } from "@/lib/data/services";
import { HERO_HOME_IMAGE, HERO_PRO_IMAGE } from "@/lib/site";
import type { Provider } from "@/lib/types";

/** Main business-gallery banner for professional cards. Logo stays on the small overlay. */
export function getProviderCardCover(provider: Provider) {
  const banner =
    provider.coverImage?.trim() ||
    provider.images?.find((src) => Boolean(src?.trim()))?.trim() ||
    provider.gallery?.find((src) => Boolean(src?.trim()))?.trim();
  return banner || HERO_PRO_IMAGE;
}

export function getProviderProfileImage(provider: Provider) {
  return getProviderCardCover(provider);
}

/** Resolve the public main-banner URL from a professional/related API record. */
export function bannerUrlFromRecord(record: {
  coverImage?: unknown;
  bannerUrl?: unknown;
  businessGallery?: unknown;
  gallery?: unknown;
  images?: unknown;
} | null | undefined): string | undefined {
  if (!record) return undefined;
  if (typeof record.coverImage === "string" && record.coverImage.trim()) {
    return record.coverImage.trim();
  }
  if (typeof record.bannerUrl === "string" && record.bannerUrl.trim()) {
    return record.bannerUrl.trim();
  }
  const gallery = normalizeBusinessGallery(
    record.businessGallery ?? record.gallery,
  );
  const banner = galleryBanner(gallery);
  if (banner?.url) return banner.url;
  return undefined;
}

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

export function getCategoryStartingPrice(categoryId: string) {
  return basePriceByCategory[categoryId] ?? 99;
}

export function getServiceImagePool(categoryId: string) {
  const category = getServiceCategoryById(categoryId);
  return [category?.image].filter((src): src is string => Boolean(src));
}

export function getJobImage(categoryId: string, job: string, _index?: number) {
  const uploaded = getServiceImagePool(categoryId)[0];
  return uploaded || HERO_HOME_IMAGE;
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
  const unique = [
    ...new Set([provider.coverImage, ...(provider.images ?? [])]),
  ].filter((src): src is string => Boolean(src));

  return unique.slice(0, 8).map((src, index) => ({
    src,
    alt: provider.gallery[index] ?? `${provider.companyName} project ${index + 1}`,
  }));
}

export function getServiceAreaPoints(provider: Provider) {
  if (provider.coveragePoints?.length) {
    const seen = new Set<string>();
    return provider.coveragePoints
      .map((point, index) => ({
        id: `${point.zip || point.name || "area"}-${point.lat}-${point.lng}-${index}`,
        zip: point.zip || point.name,
        name: point.name || getAreaName(point.zip) || point.zip,
        lat: point.lat,
        lng: point.lng,
      }))
      .filter((point) => {
        const key = `${point.zip}|${point.name}|${point.lat}|${point.lng}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const seenZips = new Set<string>();
  return provider.serviceArea
    .map((zip, index) => {
      const angle = (index / Math.max(provider.serviceArea.length, 1)) * Math.PI * 2;
      const radius = 0.016 + (index % 3) * 0.007;
      return {
        id: `${zip}-${index}`,
        zip,
        name: getAreaName(zip),
        lat: provider.lat + Math.sin(angle) * radius,
        lng: provider.lng + Math.cos(angle) * radius,
      };
    })
    .filter((point) => {
      if (!point.zip || seenZips.has(point.zip)) return false;
      seenZips.add(point.zip);
      return true;
    });
}
