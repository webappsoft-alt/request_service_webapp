import { normalizeUsStateCode } from "@/lib/data/us-states";
import { providerCrmApi, publicApi } from "@/components/api/ApiRoutesFile";

type TaxRateResponse = {
  success?: boolean;
  data?: {
    stateCode?: string;
    stateName?: string;
    rate?: number;
  };
  rate?: number;
};

function http() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred to break circular import
  return require("@/components/api/apiFuntions") as typeof import("@/components/api/apiFuntions");
}

function readRate(payload: unknown): number {
  const body = (payload || {}) as TaxRateResponse;
  const raw =
    body?.data?.rate ??
    body?.rate ??
    (payload as { data?: { rate?: number } })?.data?.rate;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/**
 * Resolve admin-configured sales tax percent for a U.S. state.
 * Returns 0 when the state is unknown or no rate is configured.
 * Never cached (client or GET cache) — every call reads the live admin rate.
 */
export async function fetchTaxRatePercent(
  state: string | null | undefined,
  options?: { public?: boolean; force?: boolean },
): Promise<number> {
  const code = normalizeUsStateCode(state || "");
  if (!code) return 0;

  try {
    const endpoint = options?.public
      ? `${publicApi.taxRate}?state=${encodeURIComponent(code)}`
      : `${providerCrmApi.taxRate}?state=${encodeURIComponent(code)}`;
    const payload = await http().getData(endpoint, { silent: true, force: true });
    return readRate(payload);
  } catch {
    return 0;
  }
}

/** Stamp line items with a percent tax rate for CRM payloads. */
export function applyTaxRatePercentToItems<T extends { taxRate?: number }>(
  items: T[],
  taxRatePercent: number,
): T[] {
  const rate = Math.max(0, Number(taxRatePercent) || 0);
  return (items || []).map((item) => ({ ...item, taxRate: rate }));
}

/** Display helper: always show a numeric percent (including 0). */
export function formatTaxRatePercent(rate: number | null | undefined) {
  const value = Math.max(0, Number(rate) || 0);
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

/**
 * Subtotal → State Tax → Total (cents-correct; matches backend calculateTotals).
 * Tax is computed on the pre-discount subtotal, then discount is applied to the total.
 */
export function moneyWithStateTax(
  subtotal: number,
  taxRatePercent = 0,
  discount = 0,
) {
  const safeSubtotal = Math.max(0, Math.round((Number(subtotal) || 0) * 100) / 100);
  const rate = Math.max(0, Number(taxRatePercent) || 0);
  const safeDiscount = Math.min(
    Math.max(0, Number(discount) || 0),
    safeSubtotal,
  );
  const tax =
    Math.round(((safeSubtotal * rate) / 100) * 100) / 100;
  const total =
    Math.round((Math.max(0, safeSubtotal - safeDiscount) + tax) * 100) / 100;
  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    tax,
    total,
  };
}
