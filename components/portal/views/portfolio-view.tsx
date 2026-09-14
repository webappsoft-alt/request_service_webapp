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
import { formatMoney, toTitleCase } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearPortfolioError,
  deletePortfolio,
  fetchPortfolios,
  portfolioCoverUrl,
  setPortfolioPage,
  setPortfolioSearch,
  togglePortfolioFeature,
  type PortfolioProject,
} from "@/store/portfolioSlice";

const SEARCH_DEBOUNCE_MS = 400;

function statusTone(status: PortfolioProject["status"]) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "ARCHIVED") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: PortfolioProject["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "ARCHIVED") return "Archived";
  return "Hidden";
}

export function PortfolioView() {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((state) => state.portfolio);
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
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioProject | null>(null);
  const [featuringId, setFeaturingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    void dispatch(fetchPortfolios());
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
    dispatch(clearPortfolioError());
  }, [dispatch, error, loading, mutating]);

  const tableLoading = actionLoading || (loading && items.length === 0);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setPortfolioSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setPortfolioPage(nextPage));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    const result = await dispatch(deletePortfolio(row.id));
    if (deletePortfolio.fulfilled.match(result)) {
      setDeleteTarget(null);
      toast.success(`${toTitleCase(row.title)} removed from your portfolio.`);
      void dispatch(fetchPortfolios());
      return;
    }
    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not delete portfolio project.",
    );
  }

  async function onToggleFeature(row: PortfolioProject) {
    setFeaturingId(row.id);
    const result = await dispatch(togglePortfolioFeature(row.id));
    setFeaturingId(null);
    if (togglePortfolioFeature.fulfilled.match(result)) {
      toast.success(
        result.payload.isFeatured
          ? `${toTitleCase(row.title)} is now featured.`
          : `${toTitleCase(row.title)} is no longer featured.`,
      );
      void dispatch(fetchPortfolios());
      return;
    }
    toast.error(
      typeof result.payload === "string"
        ? result.payload
        : "Could not update featured status.",
    );
  }

  return (
    <PortalPage
      eyebrow="Showcase"
      title="Portfolio"
      description="Before/after projects customers see on your public profile. Open a project to edit media, tags, and linked services."
      actions={
        <Button asChild>
          <Link href="/pro/dashboard/portfolio/new">Add project</Link>
        </Button>
      }
    >
      <PortalDataTable
        filename="portfolio"
        countLabel="projects"
        searchPlaceholder="Search portfolio"
        rows={items}
        rowKey={(row) => row.id}
        pageSize={limit}
        loading={tableLoading}
        empty={
          search.trim()
            ? "No projects match this search."
            : "No portfolio projects yet. Add your first showcase."
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
            id: "title",
            header: "Project",
            sortValue: (row) => row.title,
            searchValue: (row) =>
              `${row.title} ${row.description} ${row.tags.join(" ")}`,
            exportValue: (row) => row.title,
            cell: (row) => {
              const cover = portfolioCoverUrl(row);
              return (
                <div className="flex items-center gap-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-[#003F7D]">
                    {cover ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={cover.startsWith("http")}
                      />
                    ) : null}
                  </span>
                  <div>
                    <Link
                      href={`/pro/dashboard/portfolio/${row.id}/detail`}
                      className="font-medium text-primary hover:underline"
                    >
                      {toTitleCase(row.title)}
                    </Link>
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {row.description || row.tags[0] || "No description"}
                    </p>
                  </div>
                </div>
              );
            },
          },
          {
            id: "category",
            header: "Category",
            sortValue: (row) => row.categoryName,
            searchValue: (row) => row.categoryName,
            exportValue: (row) => row.categoryName,
            cell: (row) =>
              row.categoryName ? toTitleCase(row.categoryName) : "—",
          },
          {
            id: "cost",
            header: "Cost",
            sortValue: (row) => row.cost,
            searchValue: (row) => String(row.cost),
            exportValue: (row) => (row.cost ? formatMoney(row.cost) : ""),
            className: "tabular-nums",
            cell: (row) => (row.cost ? formatMoney(row.cost) : "—"),
          },
          {
            id: "featured",
            header: "Featured",
            sortValue: (row) => (row.isFeatured ? 1 : 0),
            searchValue: (row) => (row.isFeatured ? "Featured" : ""),
            exportValue: (row) => (row.isFeatured ? "Yes" : "No"),
            cell: (row) => (
              <Button
                type="button"
                size="sm"
                variant={row.isFeatured ? "outline" : "default"}
                disabled={featuringId === row.id || mutating}
                onClick={() => {
                  void onToggleFeature(row);
                }}
              >
                {featuringId === row.id ? (
                  <Spinner size="sm" label="Updating featured" />
                ) : null}
                {row.isFeatured ? "Unfeature" : "Feature"}
              </Button>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => statusLabel(row.status),
            exportValue: (row) => statusLabel(row.status),
            cell: (row) => (
              <StatusPill
                label={statusLabel(row.status)}
                tone={statusTone(row.status)}
              />
            ),
          },
        ]}
        actions={(row) => [
          { label: "Detail", href: `/pro/dashboard/portfolio/${row.id}/detail` },
          { label: "Edit", href: `/pro/dashboard/portfolio/${row.id}` },
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
            <DialogTitle>Delete portfolio project?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will permanently remove “${toTitleCase(deleteTarget.title)}” from your portfolio.`
                : "This will permanently remove this project from your portfolio."}
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

export { PortfolioFormView } from "@/components/portal/portfolio-file";
export { PortfolioDetailView } from "@/components/portal/views/portfolio-detail-view";
