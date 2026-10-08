"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { RequestStatusPill } from "@/components/contractor/contractor-ui";
import { ContractorReviewDialog } from "@/components/portal/contractor-review-dialog";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listContractorReviewRequests,
  type ContractorRequest,
  type ContractorRequestStatus,
  type ContractorRequestType,
  type Paginated,
} from "@/lib/api/contractor-portal-client";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { ChangeOrder } from "@/lib/types";

const PAGE_SIZE = 10;
const ALL = "__all__";

const STATUS_FILTERS: Array<{ value: ContractorRequestStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending_pro_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TYPE_FILTERS: Array<{ value: ContractorRequestType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "completion", label: "Job completion" },
  { value: "change_order", label: "Material / change order" },
];

function typeLabel(request: ContractorRequest) {
  return request.type === "completion" ? "Job completion" : "Material / change order";
}

function SenderTag({ request }: { request: ContractorRequest }) {
  const contractor = request.participantType === "contractor";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-4",
        contractor ? "bg-[#e7f5f1] text-[#0f7b68]" : "bg-[#eef3f9] text-[#003f7d]",
      )}
    >
      {contractor ? "Contractor" : "Technician"}
    </span>
  );
}

/** One line about the extra the office wrote up for an approved request. */
function extraLine(request: ContractorRequest, changeOrders: ChangeOrder[]) {
  const extra = request.changeOrderId ? changeOrders.find((co) => co.id === request.changeOrderId) : null;
  if (!extra) return "";
  const accepted = extra.fieldAcceptance?.status === "accepted" || extra.status === "approved";
  const who = request.participantType === "technician" ? "technician" : "contractor";
  return `Extra ${extra.number} · ${formatMoney(extra.total)} · ${accepted ? `accepted by ${who}` : `awaiting ${who}`}`;
}

/**
 * Job detail → Requests: completion proofs and material / change order requests
 * from the technicians and contractors on this job, as a paginated table with
 * Approve / Reject actions. The socket `contractor:requests` event keeps it live.
 */
export function JobRequestsTab({
  jobId,
  changeOrders = [],
  initialRequestId,
  onChangeOrderCreated,
  onCountsChange,
}: {
  jobId: string;
  /** The job's change orders — extras created from these requests are shown inline. */
  changeOrders?: ChangeOrder[];
  /** Deep link from a notification (?request=…). */
  initialRequestId?: string | null;
  onChangeOrderCreated: (request: ContractorRequest) => void;
  onCountsChange?: (pending: number) => void;
}) {
  // Socket `contractor:requests` bumps this so the list stays live.
  const version = useAppSelector((state) => state.contractorReviews.version);
  const [data, setData] = useState<Paginated<ContractorRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ContractorRequestStatus | "">("");
  const [type, setType] = useState<ContractorRequestType | "">("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  /** Row being reviewed, and whether the dialog opens on Approve or the Reject reason form. */
  const [picked, setPicked] = useState<{ request: ContractorRequest; mode: "review" | "reject" } | null>(null);
  const [deepLinkId, setDeepLinkId] = useState<string | null>(initialRequestId || null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch below
    setLoading(true);
    listContractorReviewRequests({ jobId, status: status || "all", type: type || undefined, page, limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err) || "Could not load requests.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Pending total for the tab badge (independent of the page / filters shown).
    listContractorReviewRequests({ jobId, status: "pending_pro_approval", page: 1, limit: 1 })
      .then((result) => {
        if (!cancelled) onCountsChange?.(result.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCountsChange is a display callback
  }, [jobId, status, type, page, version, reload]);

  // Deep link from a notification: open that request once it is on the page.
  const deepLinked = deepLinkId ? data?.items.find((row) => row.id === deepLinkId) : null;
  const active = picked ?? (deepLinked ? { request: deepLinked, mode: "review" as const } : null);

  function closeDialog() {
    setPicked(null);
    setDeepLinkId(null);
    setReload((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-foreground">Requests</p>
        <p className="text-xs text-muted-foreground">
          Completion proof and material / change order requests from the technicians and contractors on this job.
        </p>
      </div>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <PortalDataTable
        filename="job-requests"
        countLabel="Requests"
        hideSearch
        loading={loading}
        empty={
          status || type
            ? "No requests match these filters."
            : "No requests yet. Technicians and contractors send them from their portal."
        }
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => setPicked({ request: row, mode: "review" })}
        rowClassName={(row) => (row.status === "pending_pro_approval" ? "bg-amber-50/40" : undefined)}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-48">
              <Select
                value={type || ALL}
                onValueChange={(value) => {
                  setType(value === ALL ? "" : (value as ContractorRequestType));
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Filter by type" size="sm" className="h-8 w-full border-border-soft text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent position="popper" align="end" className="z-[100] w-[var(--radix-select-trigger-width)]">
                  {TYPE_FILTERS.map((option) => (
                    <SelectItem key={option.label} value={option.value || ALL}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-8 w-40">
              <Select
                value={status || ALL}
                onValueChange={(value) => {
                  setStatus(value === ALL ? "" : (value as ContractorRequestStatus));
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Filter by status" size="sm" className="h-8 w-full border-border-soft text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent position="popper" align="end" className="z-[100] w-[var(--radix-select-trigger-width)]">
                  {STATUS_FILTERS.map((option) => (
                    <SelectItem key={option.label} value={option.value || ALL}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        serverPagination={{
          page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: setPage,
          search: "",
          onSearchChange: () => undefined,
        }}
        columns={[
          {
            id: "requestedBy",
            header: "Requested by",
            className: "min-w-40",
            exportValue: (row) => `${row.requesterName} (${row.participantType})`,
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-foreground">{row.requesterName || "—"}</span>
                <SenderTag request={row} />
              </div>
            ),
          },
          {
            id: "type",
            header: "Type",
            exportValue: typeLabel,
            cell: (row) => (
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm">{typeLabel(row)}</span>
                <RequestStatusPill status={row.status} type={row.type} />
              </div>
            ),
          },
          {
            id: "details",
            header: "Details",
            className: "min-w-64 max-w-[26rem]",
            exportValue: (row) => (row.type === "completion" ? row.notes || "" : row.description),
            cell: (row) => {
              const sub =
                row.type === "completion"
                  ? [`${row.photos.length} photo${row.photos.length === 1 ? "" : "s"}`, row.reviewNote && `Office: ${row.reviewNote}`]
                  : [extraLine(row, changeOrders) || `Estimate ${formatMoney(row.estimatedCost)}`, row.reviewNote && `Office: ${row.reviewNote}`];
              return (
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm text-foreground">
                    {row.type === "completion" ? row.notes || "Work completed" : row.description}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{sub.filter(Boolean).join(" · ")}</p>
                </div>
              );
            },
          },
          {
            id: "createdAt",
            header: "Created at",
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => <span className="whitespace-nowrap text-sm">{formatDate(row.createdAt)}</span>,
          },
        ]}
        actions={(row) => [
          { label: "View", icon: <Eye />, onSelect: () => setPicked({ request: row, mode: "review" }) },
          ...(row.status === "pending_pro_approval"
            ? [
                {
                  label: row.type === "completion" ? "Approve" : "Accept",
                  icon: <CheckCircle2 />,
                  onSelect: () => setPicked({ request: row, mode: "review" }),
                },
                {
                  label: row.type === "completion" ? "Reject" : "Decline",
                  icon: <XCircle />,
                  variant: "destructive" as const,
                  onSelect: () => setPicked({ request: row, mode: "reject" }),
                },
              ]
            : []),
        ]}
      />

      <ContractorReviewDialog
        request={active?.request ?? null}
        open={Boolean(active)}
        initialMode={active?.mode}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        onApproved={(request) => {
          if (request.type === "change_order") onChangeOrderCreated(request);
        }}
      />
    </div>
  );
}
