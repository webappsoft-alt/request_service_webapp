import { deleteData, getData, invalidateGetCache, putData } from "@/components/api/apiFuntions";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";
import type { JobCostLine } from "@/components/portal/use-job-costing";

export type EstimateTemplateKind = "labor" | "material" | "equipment";

export type EstimateTemplateItem = {
  section: string;
  kind: EstimateTemplateKind;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type EstimateTemplateTotals = {
  labor: number;
  material: number;
  equipment: number;
  total: number;
  laborHours: number;
  itemCount: number;
};

export type EstimateTemplate = {
  /** Mongo id for custom templates; `default:<category>:<subcategory>` for platform ones. */
  id: string;
  source: "default" | "custom";
  categoryKey: string;
  categoryName: string;
  subcategoryName: string;
  name: string;
  scopeOfWork: string;
  items: EstimateTemplateItem[];
  totals: EstimateTemplateTotals;
  /** Default built from the category fallback (no subcategory-specific default yet). */
  generic?: boolean;
  /** Location factor applied to a platform default's national baseline rates. */
  pricing?: EstimateTemplatePricing;
  /** The provider has a custom template for this subcategory. */
  hasCustom?: boolean;
  updatedAt?: string;
};

export type EstimateTemplatePricing = {
  source: "city" | "state" | "national";
  label: string;
  labor: number;
  material: number;
  equipment: number;
  city?: string;
  state?: string;
};

export type EstimateTemplateCategory = {
  categoryKey: string;
  categoryName: string;
  subcategories: Array<{ name: string; hasCustom: boolean }>;
};

const ROOT = "provider/estimate-templates";

function unwrap<T>(response: unknown): T {
  const root = (response || {}) as Record<string, unknown>;
  return (root.data ?? root) as T;
}

export async function getEstimateTemplateCatalog() {
  const response = await getData(providerCrmApi.estimateTemplateCatalog, {}, { silent: true });
  const rows = unwrap<EstimateTemplateCategory[]>(response);
  return Array.isArray(rows) ? rows : [];
}

export async function listEstimateTemplates(params?: { categoryKey?: string; search?: string }) {
  const response = await getData(providerCrmApi.estimateTemplates, params || {}, { silent: true });
  const rows = unwrap<EstimateTemplate[]>(response);
  return Array.isArray(rows) ? rows : [];
}

/** The provider's custom template for the subcategory, else the platform default. */
export async function resolveEstimateTemplate(categoryKey: string, subcategoryName: string) {
  const response = await getData(providerCrmApi.estimateTemplateResolve, { categoryKey, subcategoryName });
  return unwrap<EstimateTemplate>(response);
}

export async function saveCustomEstimateTemplate(input: {
  categoryKey: string;
  subcategoryName: string;
  name?: string;
  scopeOfWork?: string;
  items: EstimateTemplateItem[];
}) {
  const response = await putData(providerCrmApi.estimateTemplateCustom, input);
  invalidateGetCache(ROOT);
  return unwrap<EstimateTemplate>(response);
}

export async function deleteCustomEstimateTemplate(id: string) {
  const response = await deleteData(providerCrmApi.estimateTemplateCustomById(id));
  invalidateGetCache(ROOT);
  return unwrap<{ id: string; deleted: boolean }>(response);
}

/** Template rows → editable estimate lines (fresh ids each load). */
export function templateItemsToLines(items: EstimateTemplateItem[]): JobCostLine[] {
  const stamp = Date.now().toString(36);
  return items.map((item, index) => {
    const kind = item.kind === "material" ? "materials" : item.kind === "equipment" ? "equipment" : "labor";
    return {
      id: `tpl_${stamp}_${index}`,
      description: item.description,
      kind,
      quantity: Number(item.quantity) || 1,
      unit: item.unit || (kind === "labor" ? "hr" : "ea"),
      unitPrice: Number(item.unitPrice) || 0,
      ...(kind === "materials" ? { images: [] } : {}),
      ...(item.section ? { section: item.section } : {}),
    };
  });
}

/** Estimate lines → template rows (blank rows dropped). */
export function linesToTemplateItems(lines: JobCostLine[]): EstimateTemplateItem[] {
  return lines
    .filter((line) => line.description.trim())
    .map((line) => ({
      section: String(line.section || "").trim(),
      kind: line.kind === "materials" ? "material" : line.kind === "equipment" ? "equipment" : "labor",
      description: line.description.trim(),
      quantity: Math.max(0, Number(line.quantity) || 0),
      unit: line.unit || "",
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    }));
}

/** Stable fingerprint of scope + lines — detects edits after a template was loaded. */
export function templateSignature(scope: string, lines: JobCostLine[]) {
  return JSON.stringify([
    scope.trim(),
    linesToTemplateItems(lines).map((item) => [item.section, item.kind, item.description, item.quantity, item.unit, item.unitPrice]),
  ]);
}

/** Match an opportunity's free-text category name to a catalog entry. */
export function findTemplateCategory(catalog: EstimateTemplateCategory[], categoryName?: string | null) {
  const wanted = String(categoryName || "").trim().toLowerCase();
  if (!wanted) return null;
  return catalog.find((row) => row.categoryName.toLowerCase() === wanted || row.categoryKey === wanted) || null;
}
