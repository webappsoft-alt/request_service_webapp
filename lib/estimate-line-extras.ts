/**
 * Estimate spreadsheet fields shared by the workspace lines, estimate items and the API payload:
 * cost per unit + profit % (which explain the unit price), and optional add-ons / alternatives
 * (shown to the customer, not in the total, not carried to the job).
 */
export type LineExtras = {
  unitCost?: number | null;
  profitPercent?: number | null;
  optional?: boolean;
  optionGroup?: string;
};

/** The unit price that cost + profit % give (rounded to cents), or null without a cost. */
export function priceFromCost(unitCost?: number | null, profitPercent?: number | null) {
  const cost = Number(unitCost);
  if (unitCost == null || !Number.isFinite(cost)) return null;
  const pct = Number(profitPercent) || 0;
  return Math.round(cost * (1 + pct / 100) * 100) / 100;
}

/** Profit % that a cost and a price imply (one decimal), or null without a cost. */
export function profitFromPrice(unitCost?: number | null, unitPrice?: number | null) {
  const cost = Number(unitCost);
  const price = Number(unitPrice);
  if (unitCost == null || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(price)) return null;
  return Math.round(((price - cost) / cost) * 1000) / 10;
}

/** Customer-safe part: whether the line is an optional add-on, and what it is an option for. */
export function optionExtras(line: LineExtras) {
  return line.optional
    ? { optional: true as boolean, ...(line.optionGroup?.trim() ? { optionGroup: line.optionGroup.trim() } : {}) }
    : {};
}

/** All fields that are set, for the pro's own records (never the customer's copy: cost is internal). */
export function lineExtras(line: LineExtras) {
  return {
    ...(line.unitCost != null && Number.isFinite(Number(line.unitCost)) ? { unitCost: Number(line.unitCost) } : {}),
    ...(line.profitPercent != null && Number.isFinite(Number(line.profitPercent))
      ? { profitPercent: Number(line.profitPercent) }
      : {}),
    ...optionExtras(line),
  };
}
