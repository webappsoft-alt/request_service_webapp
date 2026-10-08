"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContractorChatButton, ContractorMapButton } from "@/components/contractor/contractor-job-actions";
import { CompletionStatePill, RequirementSummary, siteLine } from "@/components/contractor/contractor-ui";
import { useContractorSectionSeen } from "@/components/contractor/use-contractor-section-seen";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { JobStatusPill } from "@/components/technician/tech-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contractorPaths } from "@/lib/contractor-paths";
import { JOB_STATUS_FILTERS } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { CONTRACTOR_PAGE_SIZE, fetchContractorJobs } from "@/store/contractorPortalSlice";

const ALL = "__all__";

export function ContractorJobsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.contractorPortal.jobs);
  const version = useAppSelector((state) => state.contractorPortal.versions.jobs);
  /** "" = all statuses (nothing sent to the API). */
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useContractorSectionSeen("jobs");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  // Fresh data whenever the page opens or a socket refresh lands; the cached
  // page stays on screen meanwhile.
  useEffect(() => {
    void dispatch(
      fetchContractorJobs({ page, limit: CONTRACTOR_PAGE_SIZE, search: debounced, status: status || undefined, force: true }),
    );
  }, [dispatch, page, debounced, status, version]);

  const rows = data?.items ?? [];

  return (
    <PortalPage
      eyebrow="Contractor / Assigned jobs"
      title={`Assigned jobs${data ? ` (${data.total})` : ""}`}
      description="Jobs the office assigned to you, with the labor, material, and equipment each one needs."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <PortalDataTable
        filename="assigned-jobs"
        countLabel="Jobs"
        searchPlaceholder="Search job #, title, address"
        loading={loading}
        empty={debounced || status ? "No jobs match your filters." : "No jobs assigned to you yet."}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => contractorPaths.job(row.id)}
        toolbar={
          <div className="h-8 w-40 sm:w-48">
            <Select
              value={status || ALL}
              onValueChange={(value) => {
                setStatus(value === ALL ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger id="contractor-jobs-status" aria-label="Filter by status" size="sm" className="h-8 w-full border-border-soft text-xs">
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
            id: "number",
            header: "Job #",
            sortValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div className="min-w-0">
                <Link href={contractorPaths.job(row.id)} className="font-semibold text-primary hover:underline">
                  {row.number || "Job"}
                </Link>
                {row.assignment.title || row.title ? (
                  <p className="truncate text-xs text-muted-foreground">{row.assignment.title || row.title}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "scheduled",
            header: "Scheduled",
            sortValue: (row) => row.scheduledAt || "",
            exportValue: (row) => (row.scheduledAt ? formatDate(row.scheduledAt) : ""),
            cell: (row) => (row.scheduledAt ? formatDate(row.scheduledAt) : "—"),
          },
          {
            id: "site",
            header: "Site",
            className: "min-w-56",
            exportValue: (row) => siteLine(row),
            cell: (row) => (
              <div className="flex items-center gap-2">
                <span className="line-clamp-2 min-w-0 flex-1">{siteLine(row) || "—"}</span>
                <ContractorMapButton job={row} compact />
              </div>
            ),
          },
          {
            id: "requirements",
            header: "Requirements",
            exportValue: (row) =>
              `${row.requirements.labor.length} labor, ${row.requirements.material.length} material, ${row.requirements.equipment.length} equipment`,
            cell: (row) => (
              <span className="text-xs">
                <RequirementSummary job={row} />
              </span>
            ),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            exportValue: (row) => row.status,
            cell: (row) => (
              <div className="flex flex-wrap gap-1.5">
                <JobStatusPill status={row.status} />
                <CompletionStatePill job={row} />
              </div>
            ),
          },
          {
            id: "chat",
            header: "Chat",
            className: "w-16",
            exportValue: () => "",
            cell: (row) => <ContractorChatButton jobId={row.id} number={row.number} compact />,
          },
        ]}
        actions={(row) => [{ label: "Open job", href: contractorPaths.job(row.id) }]}
      />
    </PortalPage>
  );
}
