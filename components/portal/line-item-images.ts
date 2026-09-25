/** Temporary bridge so Convert Lead → Estimate keeps material images on the detail page. */

const KEY_PREFIX = "rs-estimate-material-images:";

export type StashedMaterialImages = {
  description: string;
  images: string[];
};

export function stashEstimateMaterialImages(
  estimateId: string,
  lines: Array<{ kind?: string; description?: string; images?: string[] }>,
) {
  if (typeof window === "undefined" || !estimateId) return;
  const rows: StashedMaterialImages[] = lines
    .filter((line) => line.kind === "materials" || line.kind === "material")
    .map((line) => ({
      description: String(line.description || "").trim(),
      images: (line.images ?? [])
        .map((src) => String(src || "").trim())
        .filter(Boolean),
    }))
    .filter((row) => row.images.length > 0);
  if (!rows.length) return;
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${estimateId}`, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

export function readStashedEstimateMaterialImages(
  estimateId: string,
): StashedMaterialImages[] {
  if (typeof window === "undefined" || !estimateId) return [];
  try {
    const raw = window.sessionStorage.getItem(`${KEY_PREFIX}${estimateId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StashedMaterialImages[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearStashedEstimateMaterialImages(estimateId: string) {
  if (typeof window === "undefined" || !estimateId) return;
  try {
    window.sessionStorage.removeItem(`${KEY_PREFIX}${estimateId}`);
  } catch {
    /* ignore */
  }
}

export function mergeStashedMaterialImages<
  T extends { kind?: string; description?: string; images?: string[] },
>(estimateId: string, lines: T[]): T[] {
  const stashed = readStashedEstimateMaterialImages(estimateId);
  if (!stashed.length) return lines;
  return lines.map((line) => {
    if (line.kind !== "materials" && line.kind !== "material") return line;
    if (line.images?.length) return line;
    const match = stashed.find(
      (row) =>
        row.description &&
        row.description === String(line.description || "").trim(),
    );
    if (!match?.images?.length) return line;
    return { ...line, images: [...match.images] };
  });
}
