"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Eye, FileText, Link2, Plus, Trash2 } from "lucide-react";
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
  resolveEstimateV2Acceptance,
  type EstimateV2Opportunity,
} from "@/lib/api/estimate-v2-client";
import { shareEstimate } from "@/lib/api/crm-client";
import {
  estimateStatusLabel,
  estimateStatusToneDistinct,
  opportunityStatusLabel,
  opportunityStatusTone,
} from "@/lib/data/estimate-v2-status";
import { estimateCanShare } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LocationCell } from "@/components/portal/location-cell";

function customerLabel(opportunity: EstimateV2Opportunity) {
  const c = opportunity.customerId;
  if (!c || typeof c === "string") return "Customer";
  const company = String(c.companyName || "").trim();
  if (company) return company;
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Customer";
}

function linkedEstimate(row: EstimateV2Opportunity) {
  return row.estimates?.[0] || null;
}

function rowStatus(row: EstimateV2Opportunity) {
  return String(linkedEstimate(row)?.status || row.status || "");
}

/** Rows per page — every list in the portal pages 10 at a time. */
const ESTIMATES_PAGE_SIZE = 10;

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
        limit: ESTIMATES_PAGE_SIZE,
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

  async function convertRow(
    row: EstimateV2Opportunity,
    nextAction: "start_now" | "schedule_later" | "invoice_now",
  ) {
    const linked = linkedEstimate(row);
    if (!linked?.id) {
      toast.error("Open the estimate first.");
      return;
    }
    try {
      const result = await resolveEstimateV2Acceptance(row.id, {
        estimateId: linked.id,
        nextAction,
        markAccepted:
          linked.status !== "accepted" && linked.status !== "converted_to_job",
        signedBy: "Customer (office)",
        title: row.title,
        dueAt: nextAction === "invoice_now"
          ? (() => {
              const next = new Date();
              next.setDate(next.getDate() + 14);
              return next.toISOString().slice(0, 10);
            })()
          : undefined,
      });
      if (nextAction === "invoice_now" && result.invoice?.id) {
        toast.success(`${result.invoice.number || "Invoice"} created.`);
        router.push(`/pro/dashboard/invoices/${result.invoice.id}`);
        return;
      }
      if (result.job?.id) {
        toast.success(`${result.job.number || "Job"} created — set start and due dates.`);
        router.push(`/pro/dashboard/jobs/${result.job.id}?schedule=1`);
        return;
      }
      toast.success("Estimate updated.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not convert this estimate.",
      );
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
        pageSize={ESTIMATES_PAGE_SIZE}
        busyRowIds={deleting && deleteTarget ? [deleteTarget.id] : []}
        serverPagination={{
          page,
          pageSize: ESTIMATES_PAGE_SIZE,
          total,
          totalPages: Math.max(1, Math.ceil(total / ESTIMATES_PAGE_SIZE)),
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
        actions={(row) => {
          const linked = linkedEstimate(row);
          const status = String(linked?.status || "");
          const canConvert =
            Boolean(linked?.id) &&
            ["sent", "accepted", "converted_to_job"].includes(status);
          const jobId = linked?.jobId;
          const invoiceId = linked?.invoiceId;
          return [
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
          ...(canConvert && !jobId
            ? [
                {
                  label: "Convert to job",
                  icon: <Briefcase className="size-3.5" />,
                  onSelect: () => {
                    void convertRow(row, "schedule_later");
                  },
                },
              ]
            : []),
          ...(jobId
            ? [
                {
                  label: "Open job",
                  href: `/pro/dashboard/jobs/${jobId}`,
                  icon: <Briefcase className="size-3.5" />,
                },
              ]
            : []),
          ...(canConvert && !invoiceId
            ? [
                {
                  label: "Create invoice",
                  icon: <FileText className="size-3.5" />,
                  onSelect: () => {
                    void convertRow(row, "invoice_now");
                  },
                },
              ]
            : []),
          ...(invoiceId
            ? [
                {
                  label: "Open invoice",
                  href: `/pro/dashboard/invoices/${invoiceId}`,
                  icon: <FileText className="size-3.5" />,
                },
              ]
            : []),
          {
            label: "Delete",
            variant: "destructive" as const,
            icon: <Trash2 className="size-3.5" />,
            onSelect: () => setDeleteTarget(row),
          },
        ];
        }}
        columns={[
          {
            id: "number",
            header: "Estimate",
            className: "w-[22rem] min-w-60 max-w-[22rem] whitespace-normal",
            sortValue: (row) => linkedEstimate(row)?.number || row.number,
            searchValue: (row) =>
              `${linkedEstimate(row)?.number || ""} ${row.number} ${row.title || ""}`,
            cell: (row) => {
              const number = linkedEstimate(row)?.number || row.number;
              return (
                <div>
                  <Link
                    href={`/pro/dashboard/new-estimate/${row.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {number}
                  </Link>
                  {row.title ? (
                    <p
                      className="mt-0.5 line-clamp-2 break-words text-xs font-medium text-foreground"
                      title={row.title}
                    >
                      {row.title}
                    </p>
                  ) : null}
                  {row.categoryName ? (
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.categoryName}
                    </p>
                  ) : null}
                </div>
              );
            },
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
            header: "Location",
            sortValue: (row) => propertyLabel(row),
            cell: (row) => (
              <LocationCell
                candidates={[row.propertyAddress]}
                map={{ recordType: "estimate", recordNumber: row.number, customerName: customerLabel(row) }}
              />
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
            id: "status",
            header: "Status",
            sortValue: (row) => rowStatus(row),
            cell: (row) => {
              const estimateStatus = linkedEstimate(row)?.status;
              if (estimateStatus) {
                return (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      estimateStatusToneDistinct(String(estimateStatus)),
                    )}
                  >
                    {estimateStatusLabel(String(estimateStatus))}
                  </span>
                );
              }
              return (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    opportunityStatusTone(row.status),
                  )}
                >
                  {opportunityStatusLabel(row.status)}
                </span>
              );
            },
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
