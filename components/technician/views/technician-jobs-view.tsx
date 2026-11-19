"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CrewWorkTable,
  loadAllPages,
  orderWorkRow,
  useCrewOrderRows,
  type CrewWorkRow,
} from "@/components/portal/orders/crew-work-list";
import { markCrewOrdersSeen } from "@/components/portal/orders/use-crew-open-orders";
import { PortalPage } from "@/components/portal/portal-page";
import { TechChatButton } from "@/components/tech-chat/tech-chat-button";
import { JobStatusPill, LocationBlock, customerName } from "@/components/technician/tech-ui";
import { useTechSectionSeen } from "@/components/technician/use-tech-section-seen";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listTechnicianJobs, type TechJobRow } from "@/lib/api/technician-client";
import { technicianPaths } from "@/lib/technician-paths";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTechJobs } from "@/store/technicianSlice";

// "All" first and by default, so finished jobs stay visible next to open ones.
const SCOPES = [
  { id: "all", label: "All statuses" },
  { id: "open", label: "Open" },
  { id: "done", label: "Completed" },
] as const;

/** Jobs per request for the combined list (API max). */
const JOBS_BATCH = 100;

/**
 * Technician "My jobs": jobs and assigned fixed-price orders in ONE list (newest first),
 * filtered by status. Jobs come from the technician slice (page 1, cached / de-duplicated);
 * orders from the shared crewOrders slice.
 * Previous: a server-paged jobs-only table, then an All · Jobs · Fixed price type filter.
 */
export function TechnicianJobsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.technician.jobs);
  const version = useAppSelector((state) => state.technician.versions.jobs);
  const [scope, setScope] = useState<"open" | "done" | "all">("all");
  const { orders, loading: ordersLoading, error: ordersError } = useCrewOrderRows("technician");
  /** Jobs beyond the first 100 (rare) — fetched only when the slice page says there are more. */
  const [moreJobs, setMoreJobs] = useState<TechJobRow[]>([]);

  useTechSectionSeen("jobs");

  // Opening Jobs clears the fixed-price part of the sidebar badge (on open, on new orders, on leave).
  useEffect(() => {
    markCrewOrdersSeen("technician");
    return () => markCrewOrdersSeen("technician");
  }, [orders]);

  // Fresh data when the tab opens, the scope changes or a socket refresh lands (version);
  // the cached list stays on screen meanwhile.
  useEffect(() => {
    void dispatch(fetchTechJobs({ page: 1, limit: JOBS_BATCH, scope, force: true }));
  }, [dispatch, scope, version]);

  const totalPages = data?.totalPages ?? 1;
  useEffect(() => {
    if (totalPages <= 1) {
      setMoreJobs([]);
      return;
    }
    let cancelled = false;
    loadAllPages(async (page) => (page === 1 ? { items: [], totalPages } : listTechnicianJobs({ page, limit: JOBS_BATCH, scope })))
      .then((items) => {
        if (!cancelled) setMoreJobs(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scope, totalPages, version]);

  const rows = useMemo<CrewWorkRow[]>(() => {
    const jobRows: CrewWorkRow[] = [...(data?.items ?? []), ...moreJobs].map((row) => ({
      key: `job:${row.id}`,
      kind: "job",
      id: row.id,
      number: row.number || "Job",
      title: row.title || "",
      customer: customerName(row.customer, row.customerSnapshot),
      phone: row.customer?.phone || "",
      address: [row.location?.address || row.location?.street, row.location?.city].filter(Boolean).join(", "),
      scheduledAt: row.scheduledAt,
      at: new Date(row.createdAt || row.scheduledAt || 0).getTime() || 0,
      status: <JobStatusPill status={row.status} />,
      statusText: row.status,
      done: false,
      href: technicianPaths.job(row.id),
      badge: row.clockedIn ? (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" aria-hidden /> Clocked in
        </span>
      ) : null,
      // Directions links inside keep their own click; the rest of the cell opens the job.
      addressCell: (
        <LocationBlock
          location={row.location}
          compact
          record={{ recordType: "job", recordNumber: row.number, customerName: customerName(row.customer, row.customerSnapshot) }}
        />
      ),
      chat: (
        <TechChatButton
          side="technician"
          contextType="job"
          contextId={row.id}
          iconOnly
          label={`Message the office about ${row.number}`}
          className="size-9 text-[var(--tech-accent,#003F7D)]"
        />
      ),
    }));
    const orderRows = (orders ?? [])
      .map((order) => orderWorkRow(order, technicianPaths.order(order.id)))
      .filter((row) => (scope === "open" ? !row.done : scope === "done" ? row.done : true));
    return [...jobRows, ...orderRows];
  }, [data, moreJobs, orders, scope]);

  const listLoading = (loading && !data) || ordersLoading;
  const listError = error || ordersError;

  return (
    <PortalPage
      eyebrow="Technician / Jobs"
      title={`My jobs${listLoading ? "" : ` (${rows.length})`}`}
      description="Only work assigned to you. Open a job for the address, scope, materials, and to clock in."
    >
      {listError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{listError}</p>
      ) : null}
      <CrewWorkTable
        filename="my-jobs"
        loading={listLoading}
        rows={rows}
        empty="No jobs assigned to you here yet."
        toolbar={
          <div className="h-8 w-36 sm:w-40">
            <Select value={scope} onValueChange={(next) => setScope(next as "open" | "done" | "all")}>
              <SelectTrigger id="tech-jobs-scope" aria-label="Filter by status" size="sm" className="h-8 w-full border-border-soft text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[150px]">
                {SCOPES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
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
