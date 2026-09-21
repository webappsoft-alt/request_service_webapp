import { serviceCategories } from "@/lib/data/services";
import { HERO_HOME_IMAGE } from "@/lib/site";

/** Map API/public slug (or name) onto seed `cat_*` ids when possible. */
export function resolveLocalCategoryId(
  slugOrId?: string | null,
  name?: string | null,
): string | null {
  const raw = String(slugOrId || "").trim().toLowerCase();
  if (!raw && !name) return null;
  if (raw.startsWith("cat_")) return raw;

  const bySlug = serviceCategories.find((c) => c.slug === raw || c.id === raw);
  if (bySlug) return bySlug.id;

  const needle = String(name || raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const byName = serviceCategories.find((c) => {
    const n = c.name.toLowerCase();
    return n === needle || needle.includes(n) || n.includes(needle);
  });
  return byName?.id ?? null;
}

export type CategoryImageSource = {
  id?: string;
  name?: string;
  slug?: string;
  images?: string[];
  isSubcategory?: boolean;
  parent?: {
    name?: string;
    slug?: string;
    id?: string;
    images?: string[];
  } | null;
  index?: number;
  usedCounts?: Map<string, number>;
};

export function firstApiImage(images?: string[]): string {
  return images?.find((src) => Boolean(String(src || "").trim()))?.trim() || "";
}

function isHostedUpload(src: string) {
  return /^https:\/\/storage\.googleapis\.com\//i.test(src);
}

/** Use the subcategory's own uploaded photo. Do not copy the parent photo onto every child. */
export function resolveCategoryDisplayImage(source: CategoryImageSource): string {
  const own = firstApiImage(source.images);
  const parent = firstApiImage(source.parent?.images);
  if (source.isSubcategory) {
    if (own && own !== parent) return own;
    if (own && isHostedUpload(own) && own !== parent) return own;
    return "";
  }
  return own || parent || HERO_HOME_IMAGE;
}

export function assignCategoryDisplayImages(
  items: CategoryImageSource[],
  parent?: CategoryImageSource["parent"],
): string[] {
  return items.map((item) =>
    resolveCategoryDisplayImage({
      ...item,
      parent: parent ?? item.parent,
      isSubcategory: true,
    }),
  );
}
