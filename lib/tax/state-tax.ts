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

const cache = new Map<string, { rate: number; at: number }>();
const TTL_MS = 5 * 60 * 1000;

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
 */
export async function fetchTaxRatePercent(
  state: string | null | undefined,
  options?: { public?: boolean; force?: boolean },
): Promise<number> {
  const code = normalizeUsStateCode(state || "");
  if (!code) return 0;

  const cached = cache.get(code);
  if (!options?.force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.rate;
  }

  try {
    const endpoint = options?.public
      ? `${publicApi.taxRate}?state=${encodeURIComponent(code)}`
      : `${providerCrmApi.taxRate}?state=${encodeURIComponent(code)}`;
    const payload = await http().getData(endpoint, {
      silent: true,
      ...(options?.force ? { force: true } : {}),
    });
    const rate = readRate(payload);
    cache.set(code, { rate, at: Date.now() });
    return rate;
  } catch {
    return cached?.rate ?? 0;
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

export function invalidateTaxRateCache(stateCode?: string) {
  if (stateCode) {
    const code = normalizeUsStateCode(stateCode);
    if (code) cache.delete(code);
    return;
  }
  cache.clear();
}
