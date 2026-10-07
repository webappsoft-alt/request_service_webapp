"use client";

import { useEffect, useState } from "react";
import { getData } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";

/** Business-profile category id (`cat_<slug>`) → its subcategory (job) names, in admin sort order. */
export type CategoryJobsMap = Record<string, string[]>;

let cache: CategoryJobsMap | null = null;
let pending: Promise<CategoryJobsMap> | null = null;

function categoryKeyOf(slug: unknown) {
  const raw = String(slug || "").trim().toLowerCase().replace(/-/g, "_");
  return raw ? `cat_${raw}` : "";
}

/** One request for every active category with its nested active subcategories. */
async function loadCategoryJobs(): Promise<CategoryJobsMap> {
  const response = await getData(publicApi.categories, { only_parent: true, limit: 100 }, { silent: true, token: null });
  const root = (response || {}) as Record<string, unknown>;
  const list = Array.isArray(root.data) ? root.data : Array.isArray(response) ? response : [];
  const map: CategoryJobsMap = {};
  for (const raw of list as Array<Record<string, unknown>>) {
    const key = categoryKeyOf(raw?.slug);
    const children = Array.isArray(raw?.children) ? (raw.children as Array<Record<string, unknown>>) : [];
    const names = children.map((child) => String(child?.name || "").trim()).filter(Boolean);
    if (key && names.length) map[key] = names;
  }
  return map;
}

/**
 * Live "Jobs you offer" lists from the database, so the profile picker always
 * matches the subcategories that estimate templates use.
 * `jobsFor(id, fallback)` returns the fallback (static list) until loaded or if the request fails.
 */
export function useCategoryJobs() {
  const [jobs, setJobs] = useState<CategoryJobsMap | null>(cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    pending ??= loadCategoryJobs()
      .then((map) => {
        if (Object.keys(map).length) cache = map;
        return map;
      })
      .finally(() => {
        pending = null;
      });
    pending
      .then((map) => {
        if (!cancelled) setJobs(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loaded: Boolean(jobs),
    jobsFor: (categoryId: string, fallback: readonly string[] = []) => {
      const live = jobs?.[categoryId];
      return live?.length ? live : [...fallback];
    },
  };
}
