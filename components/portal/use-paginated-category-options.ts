"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getData } from "@/components/api/sliceHttp";
import { publicApi } from "@/components/api/ApiRoutesFile";
import {
  normalizePublicCategory,
  type PublicCategory,
} from "@/store/categoriesSlice";
import type { CategoryOption } from "@/components/portal/paginated-category-select";

export const CATEGORY_DROPDOWN_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type Mode = "parents" | "subs";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractList(response: unknown): PublicCategory[] {
  const root = asRecord(response) ?? {};
  const list =
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray(root.categories) && root.categories) ||
    (Array.isArray(response) && response) ||
    [];
  return list
    .map(normalizePublicCategory)
    .filter((item): item is PublicCategory => Boolean(item));
}

function extractHasMore(response: unknown, pageSize: number, count: number) {
  const root = asRecord(response) ?? {};
  const pagination = asRecord(root.pagination) ?? {};
  const page = Math.max(1, Number(pagination.page ?? 1) || 1);
  const totalPages = Math.max(1, Number(pagination.totalPages ?? 1) || 1);
  const rawNext = pagination.hasNextPage;
  if (rawNext === true || rawNext === "true") return true;
  if (rawNext === false || rawNext === "false") return false;
  return page < totalPages || count >= pageSize;
}

/**
 * Infinite-scroll category options for dropdowns.
 * Calls the same public categories API with optional debounced `search`.
 * Local state only — does not mutate the shared categories Redux store.
 */
export function usePaginatedCategoryOptions(
  mode: Mode | null,
  enabled: boolean,
  parentId?: string,
  pageSize = CATEGORY_DROPDOWN_PAGE_SIZE,
) {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const inFlightPageRef = useRef<number | null>(null);
  const categoriesRef = useRef<PublicCategory[]>([]);
  const modeRef = useRef(mode);
  const parentIdRef = useRef(parentId);
  modeRef.current = mode;
  parentIdRef.current = parentId;
  categoriesRef.current = categories;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
  }, [mode, enabled, parentId]);

  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const activeMode = modeRef.current;
      if (!activeMode || !enabled) return;
      if (activeMode === "subs" && !parentIdRef.current?.trim()) return;
      if (inFlightPageRef.current === pageNum) return;

      inFlightPageRef.current = pageNum;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params: Record<string, string | number | boolean> = {
          page: pageNum,
          limit: pageSize,
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (activeMode === "parents") {
          params.only_parent = true;
        } else {
          params.parent_category_id = parentIdRef.current!.trim();
        }

        const response = await getData(publicApi.categories, params, {
          silent: true,
          token: null,
        });

        if (modeRef.current !== activeMode) return;
        if (
          activeMode === "subs" &&
          parentIdRef.current?.trim() !== parentId?.trim()
        ) {
          return;
        }

        let items = extractList(response);
        if (activeMode === "parents") {
          items = items.filter((item) => !item.parentCategory);
        }

        if (!append) {
          categoriesRef.current = items;
          setCategories(items);
          setHasMore(extractHasMore(response, pageSize, items.length));
        } else {
          const seen = new Set(categoriesRef.current.map((item) => item.id));
          const next = items.filter((item) => !seen.has(item.id));
          const merged = [...categoriesRef.current, ...next];
          categoriesRef.current = merged;
          setCategories(merged);
          setHasMore(
            extractHasMore(response, pageSize, items.length) && next.length > 0,
          );
        }
        setPage(pageNum);
      } catch {
        if (modeRef.current === activeMode && !append) {
          categoriesRef.current = [];
          setCategories([]);
          setHasMore(false);
        }
      } finally {
        if (inFlightPageRef.current === pageNum) {
          inFlightPageRef.current = null;
        }
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [enabled, pageSize, debouncedSearch, parentId],
  );

  useEffect(() => {
    categoriesRef.current = [];
    setCategories([]);
    setPage(0);
    setHasMore(false);
    inFlightPageRef.current = null;
    if (!enabled || !mode) return;
    if (mode === "subs" && !parentId?.trim()) return;
    void loadPage(1, false);
  }, [mode, enabled, parentId, loadPage, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (!enabled || !mode) return;
    if (mode === "subs" && !parentId?.trim()) return;
    if (!hasMore || loading || loadingMore) return;
    if (inFlightPageRef.current !== null) return;
    void loadPage(page + 1, true);
  }, [enabled, mode, parentId, hasMore, loading, loadingMore, loadPage, page]);

  const options: CategoryOption[] = categories.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  return {
    categories,
    options,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    search: searchInput,
    setSearch: setSearchInput,
  };
}
