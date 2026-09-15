import { getServiceCategoryById, serviceCategories } from "@/lib/data/services";

/** Local photo assets used when API subcategory images duplicate the parent. */
const SERVICE_PHOTOS = [
  "/images/services/service-plumbing.jpg",
  "/images/services/service-hvac.jpg",
  "/images/services/service-electrical.jpg",
  "/images/services/service-handyman.jpg",
  "/images/services/service-cleaning.jpg",
  "/images/services/service-cleaning-work.jpg",
  "/images/services/service-roofing.jpg",
  "/images/services/service-landscaping.jpg",
  "/images/services/service-painting.jpg",
  "/images/services/service-bathroom.jpg",
  "/images/services/service-pest.jpg",
] as const;

const HOME_PHOTOS = [
  "/images/home/hero-home.jpg",
  "/images/home/step-search.jpg",
  "/images/home/step-compare.jpg",
  "/images/home/step-hire.jpg",
  "/images/home/split-homeowner.jpg",
  "/images/home/split-provider.jpg",
] as const;

const DIVERSE_POOL = [...SERVICE_PHOTOS, ...HOME_PHOTOS];

/** Keyword → preferred local photo for common job names. */
const KEYWORD_PHOTOS: Array<{ match: RegExp; src: string }> = [
  {
    match:
      /drain|clog|sewer|toilet|faucet|pipe|leak|water.?heater|garbage|disposal/i,
    src: "/images/services/service-plumbing.jpg",
  },
  {
    match: /shower|tub|bath|tile|vanity|remodel/i,
    src: "/images/services/service-bathroom.jpg",
  },
  {
    match: /\bac\b|air.?cond|furnace|hvac|thermostat|heat.?pump|duct/i,
    src: "/images/services/service-hvac.jpg",
  },
  {
    match: /outlet|switch|panel|ev.?charg|wiring|lighting|electrical|breaker/i,
    src: "/images/services/service-electrical.jpg",
  },
  {
    match: /mount|assembl|door|shelf|handyman|drywall|furniture/i,
    src: "/images/services/service-handyman.jpg",
  },
  {
    match: /clean|maid|deep.?clean|move.?out|carpet|window/i,
    src: "/images/services/service-cleaning.jpg",
  },
  {
    match: /roof|shingle|gutter|flashing/i,
    src: "/images/services/service-roofing.jpg",
  },
  {
    match: /lawn|landscap|tree|hedge|mulch|irrigation|yard/i,
    src: "/images/services/service-landscaping.jpg",
  },
  {
    match: /paint|stain|cabinet|trim|wall/i,
    src: "/images/services/service-painting.jpg",
  },
  {
    match: /pest|termite|rodent|insect|bug|ant|mosquito/i,
    src: "/images/services/service-pest.jpg",
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

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

function keywordPhoto(label: string): string | null {
  for (const entry of KEYWORD_PHOTOS) {
    if (entry.match.test(label)) return entry.src;
  }
  return null;
}

function parentLocalPool(
  parentSlugOrId?: string | null,
  parentName?: string | null,
): string[] {
  const localId = resolveLocalCategoryId(parentSlugOrId, parentName);
  const category = localId ? getServiceCategoryById(localId) : null;
  const primary = category?.image ? [category.image] : [];
  // Mix trade primary + full diverse set so siblings under one parent still vary.
  return [...new Set([...primary, ...DIVERSE_POOL])];
}

export type CategoryImageSource = {
  id?: string;
  name?: string;
  slug?: string;
  images?: string[];
  /** When true (or parent provided), diversify when API image matches parent. */
  isSubcategory?: boolean;
  parent?: {
    name?: string;
    slug?: string;
    id?: string;
    images?: string[];
  } | null;
  /** Sibling index in the visible list — keeps adjacent cards visually distinct. */
  index?: number;
  /**
   * When assigning a list, pass how many times each src was already used so
   * siblings prefer unused photos.
   */
  usedCounts?: Map<string, number>;
};

function firstApiImage(images?: string[]): string {
  return images?.find((src) => Boolean(String(src || "").trim()))?.trim() || "";
}

/**
 * Resolve a display image for parent/subcategory cards.
 * API currently copies the parent image onto every child — those get diversified
 * local photos so Browse-by-job tiles look different.
 */
export function resolveCategoryDisplayImage(source: CategoryImageSource): string {
  const apiImage = firstApiImage(source.images);
  const parentImage = firstApiImage(source.parent?.images);
  const treatAsSub = Boolean(source.isSubcategory) || Boolean(source.parent);

  // Parents (and unique subcategory uploads) keep their API photo.
  if (apiImage && (!treatAsSub || !parentImage || apiImage !== parentImage)) {
    return apiImage;
  }

  const label = `${source.name || ""} ${source.slug || ""}`.trim();
  const pool = parentLocalPool(
    source.parent?.slug || source.parent?.id,
    source.parent?.name,
  );
  if (!pool.length) return apiImage || DIVERSE_POOL[0];

  const preferred = label ? keywordPhoto(label) : null;
  const seed = hashString(
    label || source.slug || source.name || source.id || "service",
  );
  const index = typeof source.index === "number" ? source.index : 0;

  // Rank pool: unused first, then keyword match, then stable hash+index.
  const scored = pool.map((src, poolIndex) => {
    const used = source.usedCounts?.get(src) ?? 0;
    const keywordBonus = preferred && src === preferred ? 0 : 2;
    const rotation = (seed + index + poolIndex) % pool.length;
    return { src, score: used * 10 + keywordBonus + rotation / 100 };
  });
  scored.sort((a, b) => a.score - b.score);
  const chosen = scored[0]?.src || pool[index % pool.length] || pool[0];

  if (source.usedCounts) {
    source.usedCounts.set(chosen, (source.usedCounts.get(chosen) ?? 0) + 1);
  }
  return chosen;
}

/** Assign distinct-ish images for a list of subcategory cards. */
export function assignCategoryDisplayImages(
  items: CategoryImageSource[],
  parent?: CategoryImageSource["parent"],
): string[] {
  const usedCounts = new Map<string, number>();
  return items.map((item, index) =>
    resolveCategoryDisplayImage({
      ...item,
      parent: parent ?? item.parent,
      isSubcategory: true,
      index,
      usedCounts,
    }),
  );
}
