"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  queryContractors,
  queryCustomers,
  queryEstimates,
  queryInvoices,
  queryJobs,
  queryRequests,
  queryTeam,
  queryVendors,
} from "@/lib/api/crm-client";
import { crmCustomerName, type ReminderSubjectKind } from "@/lib/data/crm-people";
import { employeeName } from "@/lib/data/portal";
import type { PaginatedEntityOption } from "@/components/portal/paginated-entity-select";

export const CRM_DROPDOWN_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

export type PaginatedCrmKind = ReminderSubjectKind | "assignee";

type PageResult = {
  items: PaginatedEntityOption[];
  page: number;
  totalPages: number;
};

export type PaginatedCrmFilters = {
  customerId?: string;
  role?: string;
  /** Server-side search (debounced by the hook when using setSearch). */
  search?: string;
};

async function fetchKindPage(
  kind: PaginatedCrmKind,
  page: number,
  limit: number,
  filters: PaginatedCrmFilters = {},
): Promise<PageResult> {
  const customerId = filters.customerId?.trim() || undefined;
  const search = filters.search?.trim() || undefined;
  switch (kind) {
    case "customer": {
      const result = await queryCustomers({
        page,
        limit,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: crmCustomerName(item),
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "employee":
    case "assignee": {
      const result = await queryTeam({
        page,
        limit,
        role: filters.role?.trim() || undefined,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: employeeName(item),
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "contractor": {
      const result = await queryContractors({
        page,
        limit,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: item.companyName || `${item.firstName} ${item.lastName}`.trim(),
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "vendor": {
      const result = await queryVendors({
        page,
        limit,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: item.name,
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "estimate": {
      const result = await queryEstimates({
        page,
        limit,
        customerId,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: item.number || item.id,
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "request": {
      const result = await queryRequests({
        page,
        limit,
        customerId,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: `${item.number} · ${item.serviceName}`,
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "job": {
      const result = await queryJobs({
        page,
        limit,
        customerId,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: item.number || item.id,
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    case "invoice": {
      const result = await queryInvoices({
        page,
        limit,
        customerId,
        search,
        force: true,
        silent: true,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          label: item.number || item.id,
        })),
        page: result.page,
        totalPages: result.totalPages,
      };
    }
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

/**
 * Infinite-scroll options for CRM entity dropdowns (page/limit from MD).
 * Appends pages; skips duplicate in-flight page requests.
 * Exposes debounced `search` / `setSearch` for dropdown search fields.
 */
export function usePaginatedCrmOptions(
  kind: PaginatedCrmKind | null,
  enabled: boolean,
  pageSize = CRM_DROPDOWN_PAGE_SIZE,
  filters: PaginatedCrmFilters = {},
) {
  const [options, setOptions] = useState<PaginatedEntityOption[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const inFlightPageRef = useRef<number | null>(null);
  const optionsRef = useRef<PaginatedEntityOption[]>([]);
  const kindRef = useRef(kind);
  const filtersRef = useRef(filters);
  kindRef.current = kind;
  filtersRef.current = filters;
  optionsRef.current = options;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedSearch("");
  }, [kind, enabled]);

  const filterKey = `${filters.customerId?.trim() || ""}|${filters.role?.trim() || ""}|${debouncedSearch}`;

  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const activeKind = kindRef.current;
      if (!activeKind || !enabled) return;
      if (inFlightPageRef.current === pageNum) return;

      inFlightPageRef.current = pageNum;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const result = await fetchKindPage(activeKind, pageNum, pageSize, {
          ...filtersRef.current,
          search: debouncedSearch || filtersRef.current.search,
        });
        if (kindRef.current !== activeKind) return;

        if (!append) {
          optionsRef.current = result.items;
          setOptions(result.items);
          setHasMore(result.items.length >= pageSize);
        } else {
          const seen = new Set(optionsRef.current.map((item) => item.id));
          const next = result.items.filter((item) => !seen.has(item.id));
          const merged = [...optionsRef.current, ...next];
          optionsRef.current = merged;
          setOptions(merged);
          setHasMore(result.items.length >= pageSize && next.length > 0);
        }
        setPage(result.page);
      } catch {
        if (kindRef.current === activeKind && !append) {
          optionsRef.current = [];
          setOptions([]);
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
    [enabled, pageSize, debouncedSearch],
  );

  useEffect(() => {
    optionsRef.current = [];
    setOptions([]);
    setPage(0);
    setHasMore(false);
    inFlightPageRef.current = null;
    if (!enabled || !kind) return;
    void loadPage(1, false);
  }, [kind, enabled, loadPage, filterKey]);

  const loadMore = useCallback(() => {
    if (!enabled || !kind) return;
    if (!hasMore || loading || loadingMore) return;
    if (inFlightPageRef.current !== null) return;
    void loadPage(page + 1, true);
  }, [enabled, kind, hasMore, loading, loadingMore, loadPage, page]);

  return {
    options,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    search: searchInput,
    setSearch: setSearchInput,
  };
}
