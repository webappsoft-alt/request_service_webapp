/** Raw coverage.neighborhoods entry: ObjectId string, title string, or populated object. */
export type CoverageNeighborhoodRef =
  | string
  | {
      id?: string;
      _id?: string;
      title?: string;
      name?: string;
      [key: string]: unknown;
    };

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isLikelyObjectId(value: string): boolean {
  return OBJECT_ID_RE.test(value.trim());
}

/** Extract a stable id from a neighborhood ref when one exists. */
export function coverageNeighborhoodId(
  raw: CoverageNeighborhoodRef | null | undefined,
): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return isLikelyObjectId(trimmed) ? trimmed : null;
  }
  if (typeof raw !== "object") return null;
  const id =
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw._id === "string" && raw._id) ||
    "";
  if (id && isLikelyObjectId(id)) return id;
  return null;
}

/**
 * Display label for a coverage neighborhood.
 * Prefer populated title; resolve ObjectIds via `areasById`; never show bare ObjectIds.
 */
export function coverageNeighborhoodLabel(
  raw: CoverageNeighborhoodRef | null | undefined,
  areasById?: Map<string, string> | Record<string, string>,
): string | null {
  if (raw == null) return null;

  if (typeof raw === "object") {
    const title =
      (typeof raw.title === "string" && raw.title.trim()) ||
      (typeof raw.name === "string" && raw.name.trim()) ||
      "";
    if (title) return title;
    const id = coverageNeighborhoodId(raw);
    if (id) {
      const mapped =
        areasById instanceof Map ? areasById.get(id) : areasById?.[id];
      if (mapped?.trim()) return mapped.trim();
    }
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!isLikelyObjectId(trimmed)) return trimmed;

  const mapped =
    areasById instanceof Map ? areasById.get(trimmed) : areasById?.[trimmed];
  if (mapped?.trim()) return mapped.trim();
  return null;
}

/** Collect selectable area ids from provider coverage (ObjectIds only). */
export function coverageNeighborhoodIds(
  neighborhoods: unknown,
): string[] {
  if (!Array.isArray(neighborhoods)) return [];
  const ids: string[] = [];
  for (const item of neighborhoods) {
    const id = coverageNeighborhoodId(item as CoverageNeighborhoodRef);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Human-readable labels for company profile / workspace chips. */
export function coverageNeighborhoodLabels(
  neighborhoods: unknown,
  areasById?: Map<string, string> | Record<string, string>,
): string[] {
  if (!Array.isArray(neighborhoods)) return [];
  const labels: string[] = [];
  for (const item of neighborhoods) {
    const label = coverageNeighborhoodLabel(
      item as CoverageNeighborhoodRef,
      areasById,
    );
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
