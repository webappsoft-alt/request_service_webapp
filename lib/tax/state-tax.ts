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

/** A state ("TX" / "Texas") or an address with a city ({ city: "Austin", state: "TX" }). */
export type TaxLocation =
  | string
  | { state?: string | null; city?: string | null }
  | null
  | undefined;

/**
 * Resolve the admin-configured sales tax percent for an address: the City Tax Rate for its
 * City + State when one exists, else the State rate (fallback), else 0. Same rule the backend
 * applies when it saves (admin/tax resolveTaxRate), so previews match the saved totals.
 * Never cached (client or GET cache) — every call reads the live admin rate.
 */
export async function fetchTaxRatePercent(
  location: TaxLocation,
  options?: { public?: boolean; force?: boolean },
): Promise<number> {
  const state = typeof location === "string" ? location : location?.state;
  const city = typeof location === "string" ? "" : String(location?.city || "").trim();
  const code = normalizeUsStateCode(state || "");
  if (!code) return 0;

  try {
    const query = `state=${encodeURIComponent(code)}${city ? `&city=${encodeURIComponent(city)}` : ""}`;
    const endpoint = options?.public
      ? `${publicApi.taxRate}?${query}`
      : `${providerCrmApi.taxRate}?${query}`;
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

/**
 * Display helper: always show a numeric percent (including 0), up to 3 decimals, no trailing zeros
 * ("8", "8.25", "9.195"). 2026-11-25: was rounded to 2 decimals, which showed 9.195 as 9.2.
 */
export function formatTaxRatePercent(rate: number | null | undefined) {
  const value = Math.max(0, Number(rate) || 0);
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The percent a saved cents tax works out to. Uses 2 decimals when that reproduces the tax to the
 * cent (so 8.25% on $33.33 stays 8.25, not 8.251), otherwise 3 (9.195% on $1,000 = $91.95).
 */
export function impliedTaxRatePercent(tax: number, taxable: number) {
  if (!(taxable > 0) || !(tax > 0)) return 0;
  const exact = (tax / taxable) * 100;
  const twoDp = Math.round(exact * 100) / 100;
  if (Math.round(taxable * twoDp) / 100 === Math.round(tax * 100) / 100) return twoDp;
  return Math.round(exact * 1000) / 1000;
}

/**
 * An invoice's money exactly as the backend saved it: its tax was fixed when the invoice was
 * made (from the estimate / job lines), so it is never recalculated from an address here.
 * `taxRatePercent` is the rate that tax works out to, for the "Tax (x%)" label.
 */
export function storedInvoiceMoney(invoice: {
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
}) {
  const cents = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
  const subtotal = cents(invoice.subtotal);
  const tax = cents(invoice.tax);
  const total = cents(invoice.total);
  const amountPaid = cents(invoice.amountPaid);
  return {
    subtotal,
    discount: cents(invoice.discount),
    tax,
    total,
    amountPaid,
    balanceDue: Math.max(0, invoice.balanceDue != null ? cents(invoice.balanceDue) : cents(total - amountPaid)),
    // Tax is charged on the pre-discount subtotal (see moneyWithStateTax).
    taxRatePercent: impliedTaxRatePercent(tax, subtotal),
  };
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
