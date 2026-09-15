"use client";

import { useEffect, useRef } from "react";
import { invalidateGetCache } from "@/components/api/apiFuntions";
import { publicApi } from "@/components/api/ApiRoutesFile";
import { subscribeRealtime } from "@/components/realtime/realtime-provider";
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

const HIDDEN_REFRESH_MS = 20_000;
const PUBLIC_INVALIDATE_EVENT = "rs-public-invalidate";

function bustPublicHttpCache() {
  for (const root of PUBLIC_CACHE_ROOTS) {
    invalidateGetCache(root);
  }
}

/**
 * Keeps public marketplace data fresh:
 * - HTTP GET cache for fast revisits
 * - Soft-stale Redux + cache bust + refetch on tab focus / realtime / explicit invalidate
 */
export function PublicDataSync() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    function softRefreshPublicCatalog() {
      bustPublicHttpCache();
      dispatch(markParentCategoriesStale());
      dispatch(invalidateSubcategories());
      dispatch(markPublicFixedServicesStale());
      dispatch(markPublicProfessionalsStale());

      const state = store.getState();
      void dispatch(fetchParentCategories());

      if (state.publicFixedServices.query) {
        void dispatch(
          fetchPublicFixedServices({ query: state.publicFixedServices.query }),
        );
      }
      if (state.publicProfessionals.query) {
        void dispatch(
          fetchPublicProfessionals({ query: state.publicProfessionals.query }),
        );
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt == null) return;
      if (Date.now() - hiddenAt < HIDDEN_REFRESH_MS) return;
      softRefreshPublicCatalog();
    }

    function onExplicitInvalidate() {
      softRefreshPublicCatalog();
    }

    const unsubRealtime = subscribeRealtime((detail) => {
      const type = typeof detail.type === "string" ? detail.type : "";
      if (
        type === "ORDER_UPDATED" ||
        type === "ESTIMATE_ACCEPTED" ||
        type === "LEAD_CREATED" ||
        type === "INBOX_SUMMARY_INVALIDATE" ||
        type === "NEW_NOTIFICATION"
      ) {
        bustPublicHttpCache();
        if (type === "ORDER_UPDATED" || type === "ESTIMATE_ACCEPTED") {
          softRefreshPublicCatalog();
        }
      }
    });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(PUBLIC_INVALIDATE_EVENT, onExplicitInvalidate);

    return () => {
      unsubRealtime();
      document.removeEventListener("visibilitychange", onVisibility);
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
