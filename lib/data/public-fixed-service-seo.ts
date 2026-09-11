import { publicApi } from "@/components/api/ApiRoutesFile";
import { absoluteUrl } from "@/lib/site";

export type PublicFixedServiceSeoData = {
  id: string;
  servicesName: string;
  slug: string;
  price: number;
  unit: string;
  images: string[];
  covered: string[];
  description?: string;
  categoryName?: string;
  categorySlug?: string;
  providerName?: string;
  providerCity?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseSeoEntity(raw: unknown): PublicFixedServiceSeoData | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  const servicesName =
    typeof record.servicesName === "string" ? record.servicesName.trim() : "";
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  if (!id && !slug && !servicesName) return null;

  const category = asRecord(record.category);
  const provider = asRecord(record.provider);
  const providerLocation = asRecord(provider?.location);
  const covered = toStringArray(record.covered);
  const fromProviderDesc =
    typeof provider?.description === "string"
      ? provider.description.trim()
      : "";

  return {
    id,
    servicesName: servicesName || "Service",
    slug,
    price: toNumber(record.price, 0),
    unit: typeof record.unit === "string" ? record.unit : "",
    images: toStringArray(record.images),
    covered,
    description: fromProviderDesc || undefined,
    categoryName:
      typeof category?.name === "string" ? category.name : undefined,
    categorySlug:
      typeof category?.slug === "string" ? category.slug : undefined,
    providerName:
      typeof provider?.companyName === "string"
        ? provider.companyName
        : undefined,
    providerCity:
      typeof providerLocation?.city === "string"
        ? providerLocation.city
        : undefined,
  };
}

/**
 * Server-side fetch for live Fixed Service SEO (slug URL).
 * Uses the same public API as the client detail page.
 */
export async function fetchPublicFixedServiceForSeo(
  slug: string,
): Promise<PublicFixedServiceSeoData | null> {
  const trimmed = String(slug || "").trim();
  const base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
    /\/+$/,
    "",
  );
  if (!trimmed || !base) return null;

  try {
    const url = `${base}/${publicApi.fixedService(trimmed)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const root = asRecord(json) ?? {};
    if (root.data != null && !Array.isArray(root.data)) {
      return parseSeoEntity(root.data);
    }
    return parseSeoEntity(json);
  } catch {
    return null;
  }
}

export function buildPublicFixedServiceDescription(
  service: PublicFixedServiceSeoData,
): string {
  if (service.description?.trim()) {
    return service.description.trim().slice(0, 160);
  }
  const covered = service.covered.slice(0, 3).join(", ");
  const priceBit =
    service.price > 0
      ? ` from $${Math.round(service.price)}${service.unit ? `/${service.unit}` : ""}`
      : "";
  const providerBit = service.providerName
    ? ` by ${service.providerName}`
    : "";
  const placeBit = service.providerCity ? ` in ${service.providerCity}` : "";
  if (covered) {
    return `${service.servicesName}${priceBit}${providerBit}${placeBit}. Includes ${covered}.`.slice(
      0,
      160,
    );
  }
  return `${service.servicesName}${priceBit}${providerBit}${placeBit}. Book a fixed-price home service on Request Services.`.slice(
    0,
    160,
  );
}

/** Prefer service image; fall back to site Open Graph brand image. */
export function resolvePublicFixedServiceOgImage(
  service: PublicFixedServiceSeoData | null,
): string[] {
  const first = service?.images?.find((src) => Boolean(String(src || "").trim()));
  if (first) {
    return [first.startsWith("http") ? first : absoluteUrl(first)];
  }
  return [absoluteUrl("/opengraph-image")];
}
