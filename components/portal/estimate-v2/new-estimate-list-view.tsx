"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortalPage } from "@/components/portal/portal-page";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { shareUrlFor } from "@/components/portal/use-estimate-share";
import {
  deleteEstimateV2Opportunity,
  listEstimateV2Opportunities,
  type EstimateV2Opportunity,
} from "@/lib/api/estimate-v2-client";
import { shareEstimate } from "@/lib/api/crm-client";
import {
  estimateStatusLabel,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/lib/data/estimate-v2-status";
import { estimateCanShare } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function customerLabel(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return "Customer";
  const company = String(c.companyName || "").trim();
  if (company) return company;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Customer";
}

function propertyLabel(opportunity: EstimateV2Opportunity) {
  const p = opportunity.propertyAddress || {};
  const street = String(p.address || p.street || "").trim();
  const city = String(p.city || "").trim();
  const state = String(p.state || "").trim();
  const zip = String(p.zip || "").trim();
  const parts = [street, [city, state].filter(Boolean).join(" "), zip]
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  return parts.join(", ") || "—";
}

export function NewEstimateListView() {
  const router = useRouter();
  const [items, setItems] = useState<EstimateV2Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EstimateV2Opportunity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listEstimateV2Opportunities({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load estimates.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => items, [items]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEstimateV2Opportunity(deleteTarget.id);
      toast.success(`${deleteTarget.number} deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete estimate.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyCustomerShareLink(row: EstimateV2Opportunity) {
    const linked = row.estimates?.[0];
    const estimateId = linked?.id || row.estimateIds?.[0];
    if (!estimateId) {
      toast.error("Open the estimate and build pricing before sharing a link.");
      return;
    }
    if (linked?.status && !estimateCanShare(linked.status)) {
      toast.error("Finalize the estimate before sharing a customer link.");
      return;
    }
    try {
      let token = String(linked?.shareToken || "").trim();
      if (!token) {
        // Mints `/e/{shareToken}` without emailing — works for outside customers.
        const shared = await shareEstimate(estimateId, { skipEmail: true });
        token = String(shared.shareToken || "").trim();
      }
      if (!token) {
        toast.error("Could not create a customer share link.");
        return;
      }
      await navigator.clipboard.writeText(shareUrlFor(token));
      toast.success("Customer link copied — send it to anyone. No account needed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not copy the customer link.",
      );
    }
  }

  return (
    <PortalPage
      eyebrow="Work / Estimate"
      title={`Estimates (${total})`}
      description="Customer → property → work request → optional site assessment → estimate."
      actions={
        <Button size="sm" onClick={() => router.push("/pro/dashboard/new-estimate/new")}>
          <Plus className="size-3.5" />
          New estimate
        </Button>
      }
    >
      <PortalDataTable
        filename="estimates"
        countLabel="Estimates"
        searchPlaceholder="Search by Est #, customer, or property"
        loading={loading}
        pageSize={20}
        busyRowIds={deleting && deleteTarget ? [deleteTarget.id] : []}
        serverPagination={{
          page,
          pageSize: 20,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
          onPageChange: setPage,
          search,
          onSearchChange: (value) => {
            setPage(1);
            setSearch(value);
          },
        }}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/new-estimate/${row.id}`}
        actions={(row) => [
          {
            label: "Open",
            href: `/pro/dashboard/new-estimate/${row.id}`,
            icon: <Eye className="size-3.5" />,
            quick: true,
          },
          ...(row.estimates?.[0]?.id || row.estimateIds?.length
            ? [
                {
                  label: "Copy share link",
                  icon: <Link2 className="size-3.5" />,
                  onSelect: () => {
                    void copyCustomerShareLink(row);
                  },
                },
              ]
            : []),
          {
            label: "Delete",
            variant: "destructive",
            icon: <Trash2 className="size-3.5" />,
            onSelect: () => setDeleteTarget(row),
          },
        ]}
        columns={[
          {
            id: "number",
            header: "Estimate",
            sortValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link
                  href={`/pro/dashboard/new-estimate/${row.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.number}
                </Link>
                <p className="mt-0.5 text-xs font-medium text-foreground">{row.title}</p>
                {row.categoryName ? (
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.categoryName}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => customerLabel(row),
            cell: (row) => (
              <div>
                <p className="text-sm font-medium">{customerLabel(row)}</p>
                {typeof row.customerId === "object" && row.customerId?.phone ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.customerId.phone}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "property",
            header: "Property",
            sortValue: (row) => propertyLabel(row),
            cell: (row) => (
              <span className="text-sm text-muted-foreground">{propertyLabel(row)}</span>
            ),
          },
          {
            id: "prep",
            header: "Prep",
            sortValue: (row) => row.prepChoice || "",
            cell: (row) => {
              const label =
                row.prepChoice === "schedule_assessment"
                  ? "Site visit"
                  : row.prepChoice === "have_information"
                    ? "Have info"
                    : row.prepChoice === "create_now"
                      ? "Create now"
                      : "—";
              return (
                <span className="text-xs text-muted-foreground">{label}</span>
              );
            },
          },
          {
            id: "estimate",
            header: "Estimate",
            sortValue: (row) =>
              row.estimates?.[0]?.number || (row.estimateIds?.length ? "1" : ""),
            cell: (row) => {
              const est = row.estimates?.[0];
              if (est?.number) {
                return (
                  <div>
                    <p className="text-sm font-medium">{est.number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {estimateStatusLabel(String(est.status || "draft"))}
                    </p>
                  </div>
                );
              }
              const linked = row.estimateIds?.length || 0;
              if (linked > 0 || row.status?.startsWith("estimate_") || row.status === "won") {
                return (
                  <span className="text-xs font-medium text-foreground">
                    Linked
                  </span>
                );
              }
              return <span className="text-xs text-muted-foreground">—</span>;
            },
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            cell: (row) => (
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                  opportunityStatusTone(row.status),
                )}
              >
                {opportunityStatusLabel(row.status)}
              </span>
            ),
          },
          {
            id: "updated",
            header: "Updated",
            sortValue: (row) => row.updatedAt || "",
            cell: (row) =>
              row.updatedAt ? formatDate(row.updatedAt) : "—",
          },
        ]}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent
          showCloseButton={!deleting}
          shell={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <div className="space-y-2 px-4 pt-4 pb-3 pr-12">
            <DialogTitle>Delete estimate?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This permanently removes ${deleteTarget.number}${
                    deleteTarget.title ? ` (“${deleteTarget.title}”)` : ""
                  }, including site visits and any linked draft estimate.`
                : "This permanently removes this estimate and its site visits."}
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-input px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalPage>
  );
}
