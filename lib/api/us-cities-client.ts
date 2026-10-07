import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";

export type UsCity = {
  id: string;
  name: string;
  state: string;
  stateName: string;
  /** 0 for small towns that only appear in the ZIP data. */
  population: number;
  lat: number;
  lng: number;
  zipCount: number;
};

export type UsCityAreas = {
  city: UsCity;
  /** Nearby towns / suburbs within ~20 miles, nearest first. */
  suburbs: Array<{ name: string; state: string; population: number; lat: number; lng: number; distanceMiles: number }>;
  /** The city's ZIP (postal) areas. */
  zips: Array<{ zip: string; lat: number; lng: number }>;
};

function unwrap<T>(response: unknown): T {
  const root = (response || {}) as Record<string, unknown>;
  return (root.data ?? root) as T;
}

/**
 * Search US cities by name across all states ("den", "Denver, CO"), largest first.
 * An empty search returns the largest cities (in `state` when given).
 */
export async function searchUsCities(search: string, options?: { state?: string; limit?: number }) {
  const rows = unwrap<UsCity[]>(
    await getData(
      publicApi.usCities,
      { search: search.trim(), ...(options?.state ? { state: options.state } : {}), limit: options?.limit ?? 30 },
      { silent: true },
    ),
  );
  return Array.isArray(rows) ? rows : [];
}

export async function getUsCityAreas(state: string, city: string) {
  return unwrap<UsCityAreas>(await getData(publicApi.usCityAreas, { state, city }, { silent: true }));
}
