import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import {
  forgetCustomerEstimateToken,
  readCustomerEstimateTokens,
  rememberCustomerEstimateToken,
} from "@/lib/booking/customer-estimates-store";

export type CustomerEstimateListItem = {
  id: string;
  number: string;
  title: string;
  status: string;
  total: number;
  shareToken: string;
  issuedAt?: string | null;
  jobId?: string | null;
  jobNumber?: string | null;
  provider?: {
    id?: string;
    companyName?: string;
    slug?: string;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function mapPublicEstimate(
  token: string,
  raw: unknown,
): CustomerEstimateListItem | null {
  const root = asRecord(raw);
  const estimate = asRecord(root?.data) ?? root;
  if (!estimate) return null;

  const provider =
    asRecord(estimate.providerId) ?? asRecord(estimate.provider) ?? null;
  const id =
    stringValue(estimate.id) ||
    stringValue(estimate._id) ||
    stringValue((asRecord(estimate._id) as { $oid?: string } | null)?.$oid);
  if (!id) return null;

  return {
    id,
    number: stringValue(estimate.number),
    title: stringValue(estimate.title) || stringValue(estimate.number) || "Estimate",
    status: stringValue(estimate.status) || "sent",
    total: numberValue(estimate.total),
    shareToken: token,
    issuedAt:
      stringValue(estimate.issuedAt) ||
      stringValue(estimate.updatedAt) ||
      stringValue(estimate.createdAt) ||
      null,
    provider: provider
      ? {
          companyName: stringValue(provider.companyName),
          slug: stringValue(provider.slug),
        }
      : null,
  };
}

/** Load remembered estimate share tokens via existing public estimate API. */
export async function loadRememberedCustomerEstimates(): Promise<
  CustomerEstimateListItem[]
> {
  const tokens = readCustomerEstimateTokens();
  if (!tokens.length) return [];

  const rows = await Promise.all(
    tokens.map(async (token) => {
      try {
        const response = await getData(publicApi.estimate(token), undefined, {
          token: null,
          skipLogoutOn401: true,
          silent: true,
        });
        const mapped = mapPublicEstimate(token, response);
        if (!mapped) {
          forgetCustomerEstimateToken(token);
          return null;
        }
        rememberCustomerEstimateToken(token);
        return mapped;
      } catch {
        forgetCustomerEstimateToken(token);
        return null;
      }
    }),
  );

  return rows.filter((row): row is CustomerEstimateListItem => Boolean(row));
}
