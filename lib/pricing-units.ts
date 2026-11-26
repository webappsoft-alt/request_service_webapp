/**
 * The 12 labor / pricing units offered on every estimate, invoice, job-costing and Pro Co-pilot
 * line item (client list, in this order).
 *
 * Stored values: the four units that existed before keep their old codes ("hr", "ea", "sq ft",
 * "ft"), so saved records, AI pricing (labor = "hr") and documents keep working unchanged. The
 * new units store their label, which already reads well wherever a raw unit is printed.
 * Backend fields are free strings (max 20 chars), so every value saves as-is.
 */
export const PRICING_UNITS = [
  { value: "Fixed", label: "Fixed" },
  { value: "hr", label: "Hourly" },
  { value: "Daily", label: "Daily" },
  { value: "ea", label: "Unit" },
  { value: "sq ft", label: "Sq. Ft." },
  { value: "ft", label: "Lin. Ft." },
  { value: "Labor", label: "Labor" },
  { value: "Materials", label: "Materials" },
  { value: "Labor + Mat.", label: "Labor + Mat." },
  { value: "T&M", label: "T&M" },
  { value: "Custom", label: "Custom" },
  { value: "Recurring", label: "Recurring" },
] as const;

export type PricingUnitOption = { value: string; label: string };

/** Older spellings saved before the 12-unit list (and AI output) → the matching unit. */
const LEGACY_ALIASES: Record<string, string> = {
  hr: "hr",
  hrs: "hr",
  hour: "hr",
  hours: "hr",
  hourly: "hr",
  ea: "ea",
  each: "ea",
  unit: "ea",
  units: "ea",
  pc: "ea",
  pcs: "ea",
  "sq ft": "sq ft",
  sqft: "sq ft",
  "sq. ft.": "sq ft",
  "sq. ft": "sq ft",
  sf: "sq ft",
  "square feet": "sq ft",
  ft: "ft",
  feet: "ft",
  lf: "ft",
  "lin ft": "ft",
  "lin. ft.": "ft",
  "linear ft": "ft",
  "linear feet": "ft",
  day: "Daily",
  days: "Daily",
  daily: "Daily",
  fixed: "Fixed",
  "flat rate": "Fixed",
  "lump sum": "Fixed",
  lot: "Fixed",
  labor: "Labor",
  labour: "Labor",
  materials: "Materials",
  material: "Materials",
  "labor + mat.": "Labor + Mat.",
  "labor + materials": "Labor + Mat.",
  "t&m": "T&M",
  "time and materials": "T&M",
  custom: "Custom",
  recurring: "Recurring",
};

/**
 * The option value for a saved unit. Unknown legacy text (e.g. "gal") is returned unchanged so it
 * is never lost; `pricingUnitOptions` then lists it as an extra choice for that one line.
 */
export function normalizePricingUnit(raw: unknown, fallback = "ea"): string {
  const text = String(raw ?? "").trim();
  if (!text) return fallback;
  return LEGACY_ALIASES[text.toLowerCase()] ?? text;
}

/** Display label for any saved unit ("hr" → "Hourly", "sq ft" → "Sq. Ft.", unknown → as saved). */
export function pricingUnitLabel(raw: unknown, fallback = "Unit"): string {
  const value = normalizePricingUnit(raw, "");
  if (!value) return fallback;
  return PRICING_UNITS.find((unit) => unit.value === value)?.label ?? value;
}

/** The 12 units, plus the line's own legacy unit (kept, shown last) when it isn't one of them. */
export function pricingUnitOptions(current?: string): PricingUnitOption[] {
  const value = normalizePricingUnit(current, "");
  if (!value || PRICING_UNITS.some((unit) => unit.value === value)) return [...PRICING_UNITS];
  return [...PRICING_UNITS, { value, label: value }];
}

/** Default unit for a new line of this type (labor bills by the hour, everything else per unit). */
export function defaultPricingUnit(kind?: string): string {
  return kind === "labor" ? "hr" : "ea";
}
