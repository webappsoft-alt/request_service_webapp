"use client";

import { useEffect } from "react";
import { invalidateGetCache } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import {
  fetchParentCategories,
  invalidateSubcategories,
  markParentCategoriesStale,
} from "@/store/categoriesSlice";
import {
  fetchPublicFixedServices,
  markPublicFixedServicesStale,
} from "@/store/publicFixedServicesSlice";
import {
  fetchPublicProfessionals,
  markPublicProfessionalsStale,
} from "@/store/publicProfessionalsSlice";

const PUBLIC_CACHE_ROOTS = [
  publicApi.categories,
  publicApi.professionals,
  publicApi.fixedServices,
  publicApi.fixedServicesRelated,
  publicApi.professionalsRelated,
] as const;

const PUBLIC_INVALIDATE_EVENT = "rs-public-invalidate";

function bustPublicHttpCache() {
  for (const root of PUBLIC_CACHE_ROOTS) {
    invalidateGetCache(root);
  }
}

function isCustomerCatalogPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/services") ||
    pathname.startsWith("/find-a-professional") ||
    pathname.startsWith("/get-a-quote") ||
    pathname.startsWith("/professionals") ||
    pathname.startsWith("/fixed-services")
  );
}

/**
 * Public marketplace cache helper.
 * - No visibility / timer / polling refresh (those were firing on provider too).
 * - Explicit invalidate (e.g. after a fixed-service order) only refetches on
 *   customer catalog routes; listing pages still fetch on location/filter/search.
 */
export function PublicDataSync() {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useEffect(() => {
    function onExplicitInvalidate() {
      bustPublicHttpCache();
      dispatch(markParentCategoriesStale());
      dispatch(invalidateSubcategories());
      dispatch(markPublicFixedServicesStale());
      dispatch(markPublicProfessionalsStale());

      if (typeof window === "undefined") return;
      if (!isCustomerCatalogPath(window.location.pathname)) return;

      const state = store.getState();
      void dispatch(fetchParentCategories());
      // Only refresh lists that were already loaded on this customer page.
      if (state.publicFixedServices.loaded) {
        void dispatch(
          fetchPublicFixedServices({ query: state.publicFixedServices.query }),
        );
      }
      if (state.publicProfessionals.loaded) {
        void dispatch(
          fetchPublicProfessionals({ query: state.publicProfessionals.query }),
        );
      }
    }

    window.addEventListener(PUBLIC_INVALIDATE_EVENT, onExplicitInvalidate);

    return () => {
      window.removeEventListener(PUBLIC_INVALIDATE_EVENT, onExplicitInvalidate);
    };
  }, [dispatch, store]);

  return null;
}

/** Call after mutations that should refresh public listings immediately. */
export function invalidatePublicCatalog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PUBLIC_INVALIDATE_EVENT));
}
