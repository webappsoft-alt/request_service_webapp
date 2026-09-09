"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { ServiceAreaFormDialog } from "@/components/portal/service-area-form-dialog";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearServiceAreasError,
  deleteServiceArea,
  fetchServiceAreas,
  selectServiceAreasShowLoader,
  serviceAreasPageCacheKey,
  setServiceAreasPage,
  setServiceAreasSearch,
  type ServiceArea,
} from "@/store/serviceAreasSlice";

const SEARCH_DEBOUNCE_MS = 400;

export function ServiceAreasView() {
  const dispatch = useAppDispatch();
  const serviceAreas = useAppSelector((state) => state.serviceAreas);
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
  } = serviceAreas ?? {
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
  const softLoader = useAppSelector(selectServiceAreasShowLoader);

  const [searchInput, setSearchInput] = useState(search);
  /** Full loader for search, or first visit to a page that is not cached yet. */
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    void dispatch(fetchServiceAreas());
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
    dispatch(clearServiceAreasError());
  }, [dispatch, error, loading, mutating]);

  const showLoader = softLoader || actionLoading;

  function refreshList() {
    void dispatch(fetchServiceAreas());
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(area: ServiceArea) {
    setEditing(area);
    setDialogOpen(true);
  }

  async function handleDelete(area: ServiceArea) {
    const result = await dispatch(deleteServiceArea(area.id));
    if (deleteServiceArea.fulfilled.match(result)) {
      toast.success(`${area.title} removed.`);
      void dispatch(fetchServiceAreas());
      return;
    }
    toast.error(
      typeof result.payload === "string" ? result.payload : "Could not delete service area.",
    );
  }

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setServiceAreasSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    const cacheKey = serviceAreasPageCacheKey(search, nextPage, limit);
    const hasCache = Boolean(pagesCache?.[cacheKey]?.length);
    // Cached page → show slice data immediately; API still refreshes in the background.
    // Uncached page → show the same full loader used for search.
    if (!hasCache) setActionLoading(true);
    dispatch(setServiceAreasPage(nextPage));
  }

  return (
    <PortalPage
      eyebrow="Catalog"
      title="Service areas"
      description="Operational zones and coverage locations used when customers book fixed services."
      actions={
        <Button type="button" onClick={openCreate}>
          Add service area
        </Button>
      }
    >
      {showLoader ? (
        <div className="flex min-h-48 items-center justify-center border border-black/15 bg-card">
          <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading service areas" />
        </div>
      ) : (
        <PortalDataTable
          filename="service-areas"
          countLabel="service areas"
          searchPlaceholder="Search service areas"
          rows={items}
          rowKey={(row) => row.id}
          pageSize={limit}
          empty={loading ? "Refreshing…" : "No service areas yet. Add your first coverage zone."}
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
              id: "title",
              header: "Area",
              sortValue: (row) => row.title,
              searchValue: (row) => row.title,
              exportValue: (row) => row.title,
              cell: (row) => (
                <div>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => openEdit(row)}
                  >
                    {row.title}
                  </button>
                  <p className="max-w-md truncate text-xs text-muted-foreground">
                    {row.location.address || "No street address"}
                  </p>
                </div>
              ),
            },
            {
              id: "city",
              header: "City",
              sortValue: (row) => row.location.city,
              searchValue: (row) => row.location.city,
              exportValue: (row) => row.location.city,
              cell: (row) => row.location.city || "—",
            },
            {
              id: "zip",
              header: "ZIP",
              sortValue: (row) => row.location.zip,
              searchValue: (row) => row.location.zip,
              exportValue: (row) => row.location.zip,
              cell: (row) => row.location.zip || "—",
            },
            {
              id: "coords",
              header: "Coordinates",
              sortValue: (row) => row.location.coordinates[0],
              searchValue: (row) => row.location.coordinates.join(" "),
              exportValue: (row) =>
                `${row.location.coordinates[0]}, ${row.location.coordinates[1]}`,
              className: "tabular-nums",
              cell: (row) =>
                `${row.location.coordinates[0]}, ${row.location.coordinates[1]}`,
            },
            {
              id: "status",
              header: "Status",
              sortValue: (row) => (row.isActive ? "active" : "inactive"),
              searchValue: (row) => (row.isActive ? "Active" : "Inactive"),
              exportValue: (row) => (row.isActive ? "Active" : "Inactive"),
              cell: (row) => (
                <StatusPill
                  label={row.isActive ? "Active" : "Inactive"}
                  tone={row.isActive ? "success" : "neutral"}
                />
              ),
            },
          ]}
          actions={(row) => [
            {
              label: "Edit",
              onSelect: () => openEdit(row),
            },
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

      <ServiceAreaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        area={editing}
        onSaved={refreshList}
      />
    </PortalPage>
  );
}
