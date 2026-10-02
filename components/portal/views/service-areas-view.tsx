"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { ServiceAreaFormDialog } from "@/components/portal/service-area-form-dialog";
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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearServiceAreasError,
  deleteServiceArea,
  fetchServiceAreas,
  selectServiceAreasShowLoader,
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
  /** Soft overlay for search / pagination — not for background refresh when rows already exist. */
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceArea | null>(null);
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

  // First visit / empty slice → blocking loader.
  // Remount with cached rows → refresh silently.
  // Search & pagination → soft table overlay.
  const tableLoading = actionLoading || (loading && items.length === 0);
  const showBlockingLoader = softLoader && !actionLoading;
  const isTrulyEmpty =
    !showBlockingLoader &&
    !tableLoading &&
    total === 0 &&
    items.length === 0 &&
    !search.trim() &&
    !searchInput.trim();

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    const area = deleteTarget;
    const result = await dispatch(deleteServiceArea(area.id));
    if (deleteServiceArea.fulfilled.match(result)) {
      setDeleteTarget(null);
      toast.success(
        `${area.location.city || area.title} removed.`,
      );
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
    setActionLoading(true);
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
      {showBlockingLoader ? (
        <div className="flex min-h-48 items-center justify-center border border-input bg-card">
          <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading service areas" />
        </div>
      ) : isTrulyEmpty ? (
        <div className="flex min-h-[50vh] items-center justify-center border border-input bg-card px-6 py-16 text-center">
          <p className="max-w-md text-base text-muted-foreground">
            No service areas yet. Add your first coverage zone.
          </p>
        </div>
      ) : (
        <PortalDataTable
          filename="service-areas"
          countLabel="service areas"
          searchPlaceholder="Search service areas"
          rows={items}
          rowKey={(row) => row.id}
          pageSize={limit}
          loading={tableLoading}
          empty={
            search.trim()
              ? "No service areas match this search."
              : "No service areas yet. Add your first coverage zone."
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
              id: "areas",
              header: "Areas",
              sortValue: (row) =>
                row.areas?.map((a) => a.name).join(", ") || row.title,
              searchValue: (row) =>
                [
                  row.title,
                  row.location.city,
                  ...(row.areas?.map((a) => a.name) ?? []),
                ].join(" "),
              exportValue: (row) =>
                row.areas?.map((a) => a.name).join(", ") || row.title,
              cell: (row) => {
                const names =
                  row.areas?.length > 0
                    ? row.areas.map((a) => a.name).filter(Boolean)
                    : [row.title].filter(Boolean);
                return (
                  <div>
                    <button
                      type="button"
                      className="flex flex-wrap gap-1.5 text-left"
                      onClick={() => openEdit(row)}
                    >
                      {names.map((name) => (
                        <span
                          key={name}
                          className="rounded-md border border-input bg-card px-2 py-0.5 text-xs font-medium text-primary hover:underline"
                        >
                          {name}
                        </span>
                      ))}
                    </button>
                    <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                      {row.location.address ||
                        [row.location.city, row.location.state]
                          .filter(Boolean)
                          .join(", ") ||
                        "No address"}
                    </p>
                  </div>
                );
              },
            },
            {
              id: "city",
              header: "City",
              sortValue: (row) => row.location.city,
              searchValue: (row) =>
                [row.location.city, row.location.state].filter(Boolean).join(" "),
              exportValue: (row) =>
                [row.location.city, row.location.state]
                  .filter(Boolean)
                  .join(", ") || row.location.city,
              cell: (row) =>
                [row.location.city, row.location.state]
                  .filter(Boolean)
                  .join(", ") ||
                row.location.city ||
                "—",
            },
            {
              id: "zip",
              header: "ZIP",
              sortValue: (row) =>
                row.areas?.map((a) => a.zip).filter(Boolean).join(",") ||
                row.location.zip,
              searchValue: (row) =>
                row.areas?.map((a) => a.zip).filter(Boolean).join(" ") ||
                row.location.zip,
              exportValue: (row) => {
                const zips = [
                  ...new Set(
                    (row.areas || [])
                      .map((a) => a.zip)
                      .filter((z): z is string => Boolean(z)),
                  ),
                ];
                return zips.length
                  ? zips.join(", ")
                  : row.location.zip || "";
              },
              cell: (row) => {
                const zips = [
                  ...new Set(
                    (row.areas || [])
                      .map((a) => a.zip)
                      .filter((z): z is string => Boolean(z)),
                  ),
                ];
                if (zips.length) return zips.join(", ");
                return row.location.zip || "—";
              },
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
                setDeleteTarget(row);
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !mutating) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={!mutating} className="sm:max-w-md">
          <DialogHeader className="border-b-0">
            <DialogTitle>Delete service area?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will permanently remove “${
                    deleteTarget.location.city || deleteTarget.title
                  }” and all its areas from your service areas.`
                : "This will permanently remove this service area."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent">
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
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}
