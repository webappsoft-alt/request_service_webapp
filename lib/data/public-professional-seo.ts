import { publicApi } from "@/components/api/ApiRoutesFile";

export type PublicProfessionalSeoData = {
  id: string;
  slug: string;
  companyName: string;
  description: string;
  city: string;
  state: string;
  zip: string;
  categoryIds: string[];
  categoryNames: string[];
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

function parseSeoEntity(raw: unknown): PublicProfessionalSeoData | null {
  const record = asRecord(raw);
  if (!record) return null;
  const location = asRecord(record.location) ?? {};
  const tradeDetails = asRecord(record.tradeDetails) ?? {};
  const primaryCategory = asRecord(tradeDetails.primaryCategory) ?? {};
  const categoryIds = toStringArray(tradeDetails.categoryIds);
  const categoryNames = [
    typeof primaryCategory.name === "string" ? primaryCategory.name : "",
  ].filter(Boolean);
  const id =
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    "";
  const slug = typeof record.slug === "string" ? record.slug.trim() : "";
  const companyName =
    typeof record.companyName === "string" ? record.companyName.trim() : "";
  if (!id && !slug && !companyName) return null;

  return {
    id,
    slug,
    companyName: companyName || "Professional",
    description: typeof record.description === "string" ? record.description : "",
    city: typeof location.city === "string" ? location.city : "",
    state: typeof location.state === "string" ? location.state : "",
    zip: typeof location.zip === "string" ? location.zip : "",
    categoryIds,
    categoryNames,
  };
}

export async function fetchPublicProfessionalForSeo(
  slug: string,
): Promise<PublicProfessionalSeoData | null> {
  const trimmed = String(slug || "").trim();
  const base = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
    /\/+$/,
    "",
  );
  if (!trimmed || !base) return null;

  try {
    const response = await fetch(`${base}/${publicApi.professional(trimmed)}`, {
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
