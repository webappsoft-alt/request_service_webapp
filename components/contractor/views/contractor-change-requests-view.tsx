"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequestStatusPill } from "@/components/contractor/contractor-ui";
import { useContractorSectionSeen } from "@/components/contractor/use-contractor-section-seen";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContractorRequestStatus } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { CONTRACTOR_PAGE_SIZE, fetchContractorChangeRequests } from "@/store/contractorPortalSlice";

const ALL = "__all__";

const STATUS_FILTERS: Array<{ value: ContractorRequestStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "pending_pro_approval", label: "Pending provider review" },
  { value: "items_added_pending_assignee_acceptance", label: "Awaiting your acceptance" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABEL: Record<ContractorRequestStatus, string> = {
  pending_pro_approval: "Pending provider review",
  items_added_pending_assignee_acceptance: "Awaiting your acceptance",
  accepted: "Accepted",
  approved: "Accepted",
  rejected: "Rejected",
};

export function ContractorChangeRequestsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.changeRequests);
  const version = useAppSelector((state) => state.contractorPortal.versions.changeRequests);
  /** "" = all statuses (nothing sent to the API). */
  const [status, setStatus] = useState<ContractorRequestStatus | "">("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useContractorSectionSeen("changeRequests");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    void dispatch(
      fetchContractorChangeRequests({
        page,
        limit: CONTRACTOR_PAGE_SIZE,
        search: debounced,
        status: status || undefined,
        force: true,
      }),
    );
  }, [dispatch, page, debounced, status, version]);

  return (
    <PortalPage
      eyebrow="Contractor / Change requests"
      title="Scope change requests"
      description="Extra material or work you've asked for, and the office's response. Start a new one from an assigned job."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <PortalDataTable
        filename="change-requests"
        countLabel="Requests"
        searchPlaceholder="Search job #, description"
        loading={loading}
        empty={debounced || status ? "No change requests match your filters." : "No change requests yet. Open an assigned job to request one."}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        rowHref={(row) => contractorPaths.job(row.jobId)}
        toolbar={
          <div className="h-8 w-40 sm:w-44">
            <Select
              value={status || ALL}
              onValueChange={(value) => {
                setStatus(value === ALL ? "" : (value as ContractorRequestStatus));
                setPage(1);
              }}
            >
              <SelectTrigger id="contractor-requests-status" aria-label="Filter by status" size="sm" className="h-8 w-full border-border-soft text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[160px]">
                {STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.label} value={option.value || ALL}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        serverPagination={{
          page,
          pageSize: CONTRACTOR_PAGE_SIZE,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: setPage,
          search,
          onSearchChange: setSearch,
        }}
        columns={[
          {
            id: "job",
            header: "Job #",
            sortValue: (row) => row.job?.number || "",
            exportValue: (row) => row.job?.number || "",
            cell: (row) => (
              <div className="min-w-0">
                <Link href={contractorPaths.job(row.jobId)} className="font-semibold text-primary hover:underline">
                  {row.job?.number || "Job"}
                </Link>
                {row.job?.title ? <p className="truncate text-xs text-muted-foreground">{row.job.title}</p> : null}
              </div>
            ),
          },
          {
            id: "description",
            header: "Description",
            className: "min-w-64",
            exportValue: (row) => row.description,
            cell: (row) => (
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm">{row.description}</p>
              </div>
            ),
          },
          {
            id: "reason",
            header: "Reason",
            sortValue: (row) => row.reason,
            exportValue: (row) => row.reason,
            cell: (row) => <span className="text-sm">{row.reason || "—"}</span>,
          },
          {
            id: "requested",
            header: "Requested",
            sortValue: (row) => row.createdAt,
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => formatDate(row.createdAt),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            exportValue: (row) => STATUS_LABEL[row.status],
            cell: (row) => <RequestStatusPill status={row.status} type="change_order" />,
          },
          {
            id: "response",
            header: "Office response",
            className: "min-w-48",
            exportValue: (row) => [row.reviewNote, row.changeOrderNumber].filter(Boolean).join(" · "),
            cell: (row) =>
              row.reviewNote || row.changeOrderNumber ? (
                <div className="text-xs">
                  {row.reviewNote ? <p className="line-clamp-2">{row.reviewNote}</p> : null}
                  {row.changeOrderNumber ? <p className="text-muted-foreground">Change order {row.changeOrderNumber}</p> : null}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
        ]}
        actions={(row) => [{ label: "Open job", href: contractorPaths.job(row.jobId) }]}
      />
    </PortalPage>
  );
}
