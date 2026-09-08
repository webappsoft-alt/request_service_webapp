import type { WorkingHours } from "@/lib/types";

/** Provider business record from login /me (`user.providerId`) or top-level `provider`. */
export type AuthProviderRecord = {
  id?: string;
  _id?: string;
  userId?: string;
  companyName?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactRole?: string;
  location?: {
    type?: string;
    coordinates?: [number, number] | number[];
    city?: string;
    country?: string;
    address?: string;
    zip?: string;
    state?: string;
    [key: string]: unknown;
  };
  services?: {
    categoryIds?: string[];
    offeredJobs?: string[];
    startingPrice?: number;
    [key: string]: unknown;
  };
  profile?: {
    yearsInBusiness?: number;
    employeeCount?: string;
    licensed?: boolean;
    insured?: boolean;
    [key: string]: unknown;
  };
  coverage?: {
    neighborhoods?: string[];
    [key: string]: unknown;
  };
  settings?: {
    workingHours?: Array<
      WorkingHours & {
        _id?: string;
        id?: string;
      }
    >;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function asAuthProvider(
  value: unknown,
): AuthProviderRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as AuthProviderRecord;
}

/** Prefer top-level `provider`, else nested `user.providerId` from /me & login. */
export function extractAuthProvider(source: {
  provider?: unknown;
  user?: unknown;
}): AuthProviderRecord | null {
  const top = asAuthProvider(source.provider);
  if (top) return top;

  if (source.user && typeof source.user === "object") {
    const nested = (source.user as Record<string, unknown>).providerId;
    return asAuthProvider(nested);
  }

  return null;
}

export function providerDisplayId(
  provider: AuthProviderRecord | null | undefined,
): string {
  if (!provider) return "";
  if (typeof provider.id === "string" && provider.id) return provider.id;
  if (typeof provider._id === "string" && provider._id) return provider._id;
  return "";
}

export function workingHoursFromProvider(
  provider: AuthProviderRecord | null | undefined,
): WorkingHours[] {
  const raw = provider?.settings?.workingHours;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === "object" && typeof entry.day === "string")
    .map((entry) => ({
      day: entry.day,
      open: entry.open ?? null,
      close: entry.close ?? null,
      closed: Boolean(entry.closed),
    }));
}
