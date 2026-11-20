"use client";

import { useEffect, useMemo, useState } from "react";
import { ContractorChatButton, ContractorMapButton } from "@/components/contractor/contractor-job-actions";
import { CompletionStatePill, RequirementSummary, siteLine } from "@/components/contractor/contractor-ui";
import { useContractorSectionSeen } from "@/components/contractor/use-contractor-section-seen";
import {
  CrewWorkTable,
  loadAllPages,
  orderMatchesJobStatus,
  orderWorkRow,
  useCrewOrderRows,
  type CrewWorkRow,
} from "@/components/portal/orders/crew-work-list";
import { markCrewOrdersSeen } from "@/components/portal/orders/use-crew-open-orders";
import { PortalPage } from "@/components/portal/portal-page";
import { JobStatusPill } from "@/components/technician/tech-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listContractorJobs, type ContractorJob } from "@/lib/api/contractor-portal-client";
import { contractorPaths } from "@/lib/contractor-paths";
import { JOB_STATUS_FILTERS } from "@/lib/data/portal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContractorJobs } from "@/store/contractorPortalSlice";

const ALL = "__all__";

/** Jobs per request for the combined list (API max). */
const JOBS_BATCH = 100;

/**
 * Contractor "Assigned jobs": jobs and assigned fixed-price orders in ONE list (newest first),
 * filtered by status. Jobs come from the contractor portal slice (page 1, cached / de-duplicated);
 * orders from the shared crewOrders slice.
 * Previous: a server-paged jobs-only table, then an All · Jobs · Fixed price type filter.
 */
export function ContractorJobsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.jobs);
  const version = useAppSelector((state) => state.contractorPortal.versions.jobs);
  /** "" = all statuses (nothing sent to the API). */
  const [status, setStatus] = useState("");
  const { orders, loading: ordersLoading, error: ordersError } = useCrewOrderRows("contractor");
  /** Jobs beyond the first 100 (rare) — fetched only when the slice page says there are more. */
  const [moreJobs, setMoreJobs] = useState<ContractorJob[]>([]);

  useContractorSectionSeen("jobs");

  // Opening Jobs clears the fixed-price part of the sidebar badge (on open, on new orders, on leave).
  useEffect(() => {
    markCrewOrdersSeen("contractor");
    return () => markCrewOrdersSeen("contractor");
  }, [orders]);

  // Fresh data whenever the page opens, the status changes or a socket refresh lands; the cached
  // list stays on screen meanwhile.
  useEffect(() => {
    void dispatch(fetchContractorJobs({ page: 1, limit: JOBS_BATCH, status: status || undefined, force: true }));
  }, [dispatch, status, version]);

  const totalPages = data?.totalPages ?? 1;
  useEffect(() => {
    if (totalPages <= 1) {
      setMoreJobs([]);
      return;
    }
    let cancelled = false;
    loadAllPages(async (page) =>
      page === 1 ? { items: [], totalPages } : listContractorJobs({ page, limit: JOBS_BATCH, status: status || undefined }),
    )
      .then((items) => {
        if (!cancelled) setMoreJobs(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status, totalPages, version]);

  const rows = useMemo<CrewWorkRow[]>(() => {
    const jobRows: CrewWorkRow[] = [...(data?.items ?? []), ...moreJobs].map((row) => ({
      key: `job:${row.id}`,
      kind: "job",
      id: row.id,
      number: row.number || "Job",
      title: row.assignment.title || row.title || "",
      customer: row.customer.name,
      phone: row.customer.phone,
      address: siteLine(row),
      scheduledAt: row.scheduledAt,
      at: new Date(row.assignment.startAt || row.scheduledAt || 0).getTime() || 0,
      status: (
        <div className="flex flex-wrap gap-1.5">
          <JobStatusPill status={row.status} />
          <CompletionStatePill job={row} />
        </div>
      ),
      statusText: row.status,
      done: false,
      href: contractorPaths.job(row.id),
      badge: (
        <p className="text-[11px] text-muted-foreground">
          <RequirementSummary job={row} />
        </p>
      ),
      addressCell: (
        <div className="flex items-center gap-2">
          <span className="line-clamp-2 min-w-0 flex-1">{siteLine(row) || "—"}</span>
          <ContractorMapButton job={row} compact />
        </div>
      ),
      chat: <ContractorChatButton jobId={row.id} number={row.number} compact />,
    }));
    const orderRows = (orders ?? [])
      .filter((order) => orderMatchesJobStatus(order.status, status))
      .map((order) => orderWorkRow(order, contractorPaths.order(order.id)));
    return [...jobRows, ...orderRows];
  }, [data, moreJobs, orders, status]);

  const listLoading = (loading && !data) || ordersLoading;
  const listError = error || ordersError;

  return (
    <PortalPage
      eyebrow="Contractor / Assigned jobs"
      title={`Assigned jobs${listLoading ? "" : ` (${rows.length})`}`}
      description="Jobs the office assigned to you, with the labor, material, and equipment each one needs."
    >
      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{listError}</p>
      ) : null}

      <CrewWorkTable
        filename="assigned-jobs"
        loading={listLoading}
        rows={rows}
        empty={status ? "No jobs match your filters." : "No jobs assigned to you yet."}
        toolbar={
          <div className="h-8 w-40 sm:w-48">
            <Select value={status || ALL} onValueChange={(value) => setStatus(value === ALL ? "" : value)}>
              <SelectTrigger id="contractor-jobs-status" aria-label="Filter by status" size="sm" className="h-8 w-full text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[160px]">
                {JOB_STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.label} value={option.value || ALL}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </PortalPage>
  );
}
