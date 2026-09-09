"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { serviceUnitLabel } from "@/lib/data/portal";
import { formatMoney } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearFixedServicesError,
  deleteFixedService,
  fetchFixedServices,
  fixedServicesPageCacheKey,
  selectFixedServicesShowLoader,
  setFixedServicesPage,
  setFixedServicesSearch,
  type FixedService,
} from "@/store/fixedServicesSlice";

const SEARCH_DEBOUNCE_MS = 400;

export function ServicesView() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((state) => state.fixedServices);
  const {
    items,
    pagesCache,
    page,
    limit,
    total,
    totalPages,
    search,
    loading,
    mutating,
    error,
  } = slice ?? {
    items: [],
    pagesCache: {},
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    mutating: false,
    error: null,
  };
  const softLoader = useAppSelector(selectFixedServicesShowLoader);

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    void dispatch(fetchFixedServices());
  }, [dispatch, page, search, limit]);

  useEffect(() => {
    if (!loading) setActionLoading(false);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!error || loading || mutating) return;
    toast.error(error);
    dispatch(clearFixedServicesError());
  }, [dispatch, error, loading, mutating]);

  const showLoader = softLoader || actionLoading;

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setFixedServicesSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    const cacheKey = fixedServicesPageCacheKey(search, nextPage, limit);
    const hasCache = Boolean(pagesCache?.[cacheKey]?.length);
    if (!hasCache) setActionLoading(true);
    dispatch(setFixedServicesPage(nextPage));
  }

  async function handleDelete(row: FixedService) {
    const result = await dispatch(deleteFixedService(row.id));
    if (deleteFixedService.fulfilled.match(result)) {
      toast.success(`${row.servicesName} removed from this catalog.`);
      void dispatch(fetchFixedServices());
      return;
    }
    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not delete fixed service.",
    );
  }

  return (
    <PortalPage
      eyebrow="Catalog"
      title="Fixed services"
      description="Priced offerings customers can request from your profile. Open a service to edit photos, coverage, areas, and hours."
      actions={
        <Button asChild>
          <Link href="/pro/dashboard/services/new">Add service</Link>
        </Button>
      }
    >
      {showLoader ? (
        <div className="flex min-h-48 items-center justify-center border border-black/15 bg-card">
          <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading services" />
        </div>
      ) : (
        <PortalDataTable
          filename="services"
          countLabel="services"
          searchPlaceholder="Search services"
          rows={items}
          rowKey={(row) => row.id}
          pageSize={limit}
          empty={loading ? "Refreshing…" : "No fixed services yet. Add your first package."}
          serverPagination={{
            page,
            pageSize: limit,
            total,
            totalPages,
            onPageChange,
            search: searchInput,
            onSearchChange,
          }}
          columns={[
            {
              id: "name",
              header: "Service",
              sortValue: (row) => row.servicesName,
              searchValue: (row) =>
                `${row.servicesName} ${row.description} ${row.covered.join(" ")}`,
              exportValue: (row) => row.servicesName,
              cell: (row) => (
                <div className="flex items-center gap-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-[#003F7D]">
                    {row.images?.[0] ? (
                      <Image
                        src={row.images[0]}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={row.images[0].startsWith("http")}
                      />
                    ) : null}
                  </span>
                  <div>
                    <Link
                      href={`/pro/dashboard/services/${row.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.servicesName}
                    </Link>
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {row.description || row.covered[0] || "No description"}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              id: "category",
              header: "Category",
              sortValue: (row) => row.categoryName,
              searchValue: (row) => `${row.categoryName} ${row.subcategoryName}`,
              exportValue: (row) => row.categoryName,
              cell: (row) => row.categoryName || "—",
            },
            {
              id: "price",
              header: "Price",
              sortValue: (row) => row.price,
              searchValue: (row) => `${formatMoney(row.price)} ${row.unit}`,
              exportValue: (row) =>
                `${formatMoney(row.price)} ${serviceUnitLabel(row.unit)}`,
              className: "tabular-nums",
              cell: (row) =>
                `${formatMoney(row.price)} ${serviceUnitLabel(row.unit)}`,
            },
            {
              id: "areas",
              header: "Areas",
              sortValue: (row) => row.serviceAreaIds.length,
              searchValue: (row) => String(row.serviceAreaIds.length),
              exportValue: (row) => String(row.serviceAreaIds.length),
              cell: (row) =>
                row.serviceAreaIds.length
                  ? `${row.serviceAreaIds.length} ${row.serviceAreaIds.length === 1 ? "area" : "areas"}`
                  : "None",
            },
            {
              id: "status",
              header: "Status",
              sortValue: (row) => (row.isPublic ? "active" : "hidden"),
              searchValue: (row) => (row.isPublic ? "Active" : "Hidden"),
              exportValue: (row) => (row.isPublic ? "Active" : "Hidden"),
              cell: (row) => (
                <StatusPill
                  label={row.isPublic ? "Active" : "Hidden"}
                  tone={row.isPublic ? "success" : "neutral"}
                />
              ),
            },
          ]}
          actions={(row) => [
            { label: "Edit", href: `/pro/dashboard/services/${row.id}` },
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => {
                void handleDelete(row);
              },
            },
          ]}
        />
      )}
    </PortalPage>
  );
}

export { ServiceFormView } from "@/components/portal/service-file";
