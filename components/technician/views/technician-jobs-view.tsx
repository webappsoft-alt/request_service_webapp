"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import {
  JobStatusPill,
  LocationBlock,
  customerName,
} from "@/components/technician/tech-ui";
import { formatDate } from "@/lib/format";
import { technicianPaths } from "@/lib/technician-paths";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  TECH_PAGE_SIZE,
  fetchTechJobs,
  markTechSectionRead,
} from "@/store/technicianSlice";

const SCOPES = [
  { id: "open", label: "Open" },
  { id: "done", label: "Completed" },
  { id: "all", label: "All" },
] as const;

export function TechnicianJobsView() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.technician.jobs);
  const version = useAppSelector((state) => state.technician.versions.jobs);
  const [scope, setScope] = useState<"open" | "done" | "all">("open");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void dispatch(markTechSectionRead("jobs"));
  }, [dispatch]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    void dispatch(fetchTechJobs({ page, limit: TECH_PAGE_SIZE, search: debounced, scope, force: version > 0 }));
  }, [dispatch, page, debounced, scope, version]);

  const rows = data?.items ?? [];

  return (
    <PortalPage
      eyebrow="Technician / Jobs"
      title={`My jobs${data ? ` (${data.total})` : ""}`}
      description="Only jobs assigned to you. Open a job for the address, scope, materials, and to clock in."
    >
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <PortalDataTable
        filename="my-jobs"
        countLabel="Jobs"
        searchPlaceholder="Search job #, customer, address"
        loading={loading}
        empty={debounced ? "No jobs match your search." : "No jobs assigned to you here yet."}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => technicianPaths.job(row.id)}
        toolbar={
          <div className="inline-flex rounded-md border border-input bg-card p-0.5" role="group" aria-label="Job status">
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={scope === item.id}
                onClick={() => {
                  setScope(item.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-xs font-medium",
                  scope === item.id ? "bg-[#003F7D] text-white" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
        serverPagination={{
          page,
          pageSize: TECH_PAGE_SIZE,
          total: data?.total ?? 0,
          totalPages: data?.totalPages ?? 1,
          onPageChange: setPage,
          search,
          onSearchChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        columns={[
          {
            id: "number",
            header: "Job #",
            sortValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div className="min-w-0">
                <Link href={technicianPaths.job(row.id)} className="font-semibold text-primary hover:underline">
                  {row.number || "Job"}
                </Link>
                {row.title ? <p className="truncate text-xs text-muted-foreground">{row.title}</p> : null}
                {row.clockedIn ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" aria-hidden /> Clocked in
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => customerName(row.customer, row.customerSnapshot),
            exportValue: (row) => customerName(row.customer, row.customerSnapshot),
            cell: (row) => (
              <div>
                <p className="font-medium">{customerName(row.customer, row.customerSnapshot)}</p>
                {row.customer?.phone ? (
                  <a href={`tel:${row.customer.phone}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {row.customer.phone}
                  </a>
                ) : null}
              </div>
            ),
          },
          {
            id: "location",
            header: "Location",
            exportValue: (row) => String(row.location?.address || ""),
            className: "min-w-56",
            cell: (row) => (
              <div onClick={(event) => event.stopPropagation()}>
                <LocationBlock location={row.location} compact />
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
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            exportValue: (row) => row.status,
            cell: (row) => <JobStatusPill status={row.status} />,
          },
        ]}
        actions={(row) => [{ label: "Open job", href: technicianPaths.job(row.id) }]}
      />
    </PortalPage>
  );
}
