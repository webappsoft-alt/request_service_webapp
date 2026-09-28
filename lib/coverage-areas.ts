/** Raw coverage.neighborhoods entry: ObjectId string, title string, or populated object. */
export type CoverageNeighborhoodRef =
  | string
  | {
      id?: string;
      _id?: string;
      title?: string;
      name?: string;
      areas?: Array<{ name?: string; lat?: number; lng?: number; zip?: string }>;
      location?: {
        city?: string;
        state?: string;
        [key: string]: unknown;
      };
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

function areaNamesFromRef(raw: CoverageNeighborhoodRef): string[] {
  if (!raw || typeof raw !== "object") return [];
  if (!Array.isArray(raw.areas)) return [];
  return raw.areas
    .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
    .filter(Boolean);
}

function cityLabelFromRef(raw: CoverageNeighborhoodRef): string {
  if (!raw || typeof raw !== "object") return "";
  const city =
    typeof raw.location?.city === "string" ? raw.location.city.trim() : "";
  const state =
    typeof raw.location?.state === "string" ? raw.location.state.trim() : "";
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (typeof raw.title === "string" && raw.title.trim()) return raw.title.trim();
  return "";
}

type AreasByIdLookup =
  | Map<string, string | string[]>
  | Record<string, string | string[]>;

function labelsFromAreasById(
  id: string,
  areasById?: AreasByIdLookup,
): string[] {
  if (!areasById) return [];
  const mapped =
    areasById instanceof Map ? areasById.get(id) : areasById[id];
  if (Array.isArray(mapped)) {
    return mapped.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof mapped === "string" && mapped.trim()) return [mapped.trim()];
  return [];
}

/**
 * Display label for a coverage neighborhood.
 * Prefer populated title; resolve ObjectIds via `areasById`; never show bare ObjectIds.
 */
export function coverageNeighborhoodLabel(
  raw: CoverageNeighborhoodRef | null | undefined,
  areasById?: AreasByIdLookup,
): string | null {
  if (raw == null) return null;

  if (typeof raw === "object") {
    const names = areaNamesFromRef(raw);
    const city = cityLabelFromRef(raw);
    if (names.length) {
      return names
        .map((name) => (city ? `${name} · ${city}` : name))
        .join(", ");
    }

    const title =
      (typeof raw.title === "string" && raw.title.trim()) ||
      (typeof raw.name === "string" && raw.name.trim()) ||
      "";
    if (title) return title;
    const id = coverageNeighborhoodId(raw);
    if (id) {
      const resolved = labelsFromAreasById(id, areasById);
      if (resolved.length) return resolved.join(", ");
    }
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!isLikelyObjectId(trimmed)) return trimmed;

  const resolved = labelsFromAreasById(trimmed, areasById);
  if (resolved.length) return resolved.join(", ");
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

/**
 * Human-readable coverage chips for profile / settings.
 * Expands city docs into neighborhood names when `areas[]` is present.
 */
export function coverageNeighborhoodLabels(
  neighborhoods: unknown,
  areasById?: AreasByIdLookup,
): string[] {
  if (!Array.isArray(neighborhoods)) return [];
  const labels: string[] = [];

  for (const item of neighborhoods) {
    const ref = item as CoverageNeighborhoodRef;
    if (ref && typeof ref === "object") {
      const names = areaNamesFromRef(ref);
      const city = cityLabelFromRef(ref);
      if (names.length) {
        for (const name of names) {
          const label = city ? `${name} · ${city}` : name;
          if (!labels.includes(label)) labels.push(label);
        }
        continue;
      }
      const id = coverageNeighborhoodId(ref);
      if (id) {
        const resolved = labelsFromAreasById(id, areasById);
        if (resolved.length) {
          for (const label of resolved) {
            if (!labels.includes(label)) labels.push(label);
          }
          continue;
        }
      }
    }

    if (typeof ref === "string" && isLikelyObjectId(ref.trim())) {
      const resolved = labelsFromAreasById(ref.trim(), areasById);
      if (resolved.length) {
        for (const label of resolved) {
          if (!labels.includes(label)) labels.push(label);
        }
        continue;
      }
    }

    const label = coverageNeighborhoodLabel(ref, areasById);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

/** Selection key for one neighborhood under a city ServiceArea doc. */
export function coverageAreaSelectionKey(
  serviceAreaId: string,
  areaName: string,
): string {
  return `${serviceAreaId}::${areaName.trim()}`;
}

export function parseCoverageAreaSelectionKey(
  key: string,
): { serviceAreaId: string; areaName: string } | null {
  const idx = key.indexOf("::");
  if (idx <= 0) return null;
  const serviceAreaId = key.slice(0, idx).trim();
  const areaName = key.slice(idx + 2).trim();
  if (!serviceAreaId || !areaName) return null;
  return { serviceAreaId, areaName };
}

type ServiceAreaLabelSource = {
  title?: string;
  areas?: Array<{ name?: string }>;
  location?: { city?: string; state?: string };
};

/** One chip label per nested area (city shown on each chip). */
export function formatServiceAreaCoverageLabels(
  area: ServiceAreaLabelSource,
): string[] {
  const city =
    [area.location?.city, area.location?.state].filter(Boolean).join(", ") ||
    (area.title || "").trim();
  const names = (area.areas || [])
    .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
    .filter(Boolean);
  if (names.length) {
    return names.map((name) => (city ? `${name} · ${city}` : name));
  }
  if (city) return [city];
  return ["Untitled area"];
}

/** Single-line summary (exports / sort). Prefer chips via formatServiceAreaCoverageLabels. */
export function formatServiceAreaCoverageLabel(
  area: ServiceAreaLabelSource,
): string {
  return formatServiceAreaCoverageLabels(area).join(", ");
}
