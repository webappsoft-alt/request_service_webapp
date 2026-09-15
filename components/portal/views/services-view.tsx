"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { serviceUnitLabel } from "@/lib/data/portal";
import { formatMoney, toTitleCase } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearFixedServicesError,
  deleteFixedService,
  fetchFixedServices,
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
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    mutating: false,
    error: null,
  };

  const [searchInput, setSearchInput] = useState(search);
  /** Soft overlay for search / pagination — not for background refresh when rows already exist. */
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FixedService | null>(null);
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

  // First visit / empty slice → blocking table loader.
  // Remount with cached rows → refresh silently (no loader).
  // Search & pagination → soft overlay via actionLoading.
  const tableLoading = actionLoading || (loading && items.length === 0);

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
    setActionLoading(true);
    dispatch(setFixedServicesPage(nextPage));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    const result = await dispatch(deleteFixedService(row.id));
    if (deleteFixedService.fulfilled.match(result)) {
      setDeleteTarget(null);
      toast.success(`${toTitleCase(row.servicesName)} removed from this catalog.`);
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
      <PortalDataTable
        filename="services"
        countLabel="services"
        searchPlaceholder="Search services"
        rows={items}
        rowKey={(row) => row.id}
        pageSize={limit}
        loading={tableLoading}
        empty={
          search.trim()
            ? "No services match this search."
            : "No fixed services yet. Add your first package."
        }
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
                    href={`/pro/dashboard/services/${row.id}/detail`}
                    className="font-medium text-primary hover:underline"
                  >
                    {toTitleCase(row.servicesName)}
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
            cell: (row) =>
              row.categoryName ? toTitleCase(row.categoryName) : "—",
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
            sortValue: (row) =>
              row.serviceAreaNames.join(", ") || String(row.serviceAreaIds.length),
            searchValue: (row) =>
              row.serviceAreaNames.join(" ") || String(row.serviceAreaIds.length),
            exportValue: (row) =>
              row.serviceAreaNames.length
                ? row.serviceAreaNames.join(", ")
                : row.serviceAreaIds.length
                  ? `${row.serviceAreaIds.length} areas`
                  : "None",
            cell: (row) =>
              row.serviceAreaNames.length
                ? row.serviceAreaNames.slice(0, 2).join(", ") +
                  (row.serviceAreaNames.length > 2
                    ? ` +${row.serviceAreaNames.length - 2}`
                    : "")
                : row.serviceAreaIds.length
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
          { label: "Detail", href: `/pro/dashboard/services/${row.id}/detail` },
          { label: "Edit", href: `/pro/dashboard/services/${row.id}` },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              setDeleteTarget(row);
            },
          },
        ]}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !mutating) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!mutating} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete fixed service?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will permanently remove “${toTitleCase(deleteTarget.servicesName)}” from your catalog.`
                : "This will permanently remove this service from your catalog."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutating}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutating}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {mutating ? <Spinner size="sm" label="Deleting" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}

export { ServiceFormView } from "@/components/portal/service-file";
export { ServiceDetailView } from "@/components/portal/views/service-detail-view";
