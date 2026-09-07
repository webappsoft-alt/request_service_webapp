"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { archiveRowAction } from "@/components/portal/archive-control";
import { CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { requestStatusLabel, withArchiveFilter, type PortalRequest } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";

const filters = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Active" },
  { value: "closed", label: "History" },
];

function matchesFilter(request: PortalRequest, status: string) {
  if (!status) return true;
  if (status === "new") return request.status === "new" || request.status === "viewed";
  if (status === "contacted") {
    return (
      request.status === "contacted" ||
      request.status === "estimate_sent" ||
      request.status === "accepted" ||
      request.status === "converted_to_job"
    );
  }
  if (status === "closed") return request.status === "declined" || request.status === "closed";
  return request.status === (status as RequestStatus);
}

export function RequestsView() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const { requests } = usePortalWorkspace();
  const records = usePortalRecords();
  const [open, setOpen] = useState(false);
  const archivedOnly = status === "archived";
  const rows = records
    .listed("request", records.mergeRequests(requests), archivedOnly)
    .filter((request) => archivedOnly || matchesFilter(request, status));

  return (
    <PortalPage
      eyebrow="Work / Leads"
      title={`Leads (${rows.length})`}
      description="Website quote requests, chat, and phone leads land here. Open a lead to see their answers, discuss the work, then send an estimate."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          + Create lead
        </Button>
      }
    >
      <FilterTabs baseHref="/pro/dashboard/requests" value={status} options={withArchiveFilter(filters)} />
      <PortalDataTable
        filename="requests"
        countLabel="Leads"
        searchPlaceholder="Search leads"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/requests/${row.id}`}
        columns={[
          {
            id: "number",
            header: "Request",
            sortValue: (row) => row.number,
            searchValue: (row) => `${row.number} ${row.channel}`,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link href={`/pro/dashboard/requests/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.number}
                </Link>
                <p className="text-xs text-muted-foreground capitalize">{row.channel}</p>
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => row.customerName,
            searchValue: (row) => `${row.customerName} ${row.customerEmail}`,
            exportValue: (row) => row.customerName,
            cell: (row) =>
              row.customerId ? (
                <Link href={`/pro/dashboard/customers/${row.customerId}`} className="text-primary hover:underline">
                  {row.customerName}
                </Link>
              ) : (
                row.customerName
              ),
          },
          {
            id: "phone",
            header: "Phone",
            sortValue: (row) => row.customerPhone,
            searchValue: (row) => row.customerPhone,
            exportValue: (row) => row.customerPhone,
            cell: (row) => row.customerPhone,
          },
          {
            id: "email",
            header: "Email",
            sortValue: (row) => row.customerEmail,
            searchValue: (row) => row.customerEmail,
            exportValue: (row) => row.customerEmail,
            cell: (row) => <span className="text-primary">{row.customerEmail}</span>,
          },
          {
            id: "service",
            header: "Service",
            sortValue: (row) => row.serviceName,
            searchValue: (row) => row.serviceName,
            exportValue: (row) => row.serviceName,
            cell: (row) => row.serviceName,
          },
          {
            id: "area",
            header: "Area",
            sortValue: (row) => row.neighborhood,
            searchValue: (row) => `${row.neighborhood} ${row.zip}`,
            exportValue: (row) => `${row.neighborhood} ${row.zip}`,
            cell: (row) => (
              <div>
                {row.neighborhood}
                <p className="text-xs text-muted-foreground">{row.zip}</p>
              </div>
            ),
          },
          {
            id: "window",
            header: "Preferred",
            sortValue: (row) => row.preferredDate ?? "",
            searchValue: (row) => `${row.preferredDate ?? ""} ${row.preferredTimeWindow ?? ""}`,
            exportValue: (row) => row.preferredDate ?? "",
            cell: (row) => row.preferredDate ?? "—",
          },
          {
            id: "received",
            header: "Received",
            sortValue: (row) => row.createdAt,
            searchValue: (row) => formatDate(row.createdAt),
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => formatDate(row.createdAt),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => requestStatusLabel(row.status),
            exportValue: (row) => requestStatusLabel(row.status),
            cell: (row) => <StatusPill label={requestStatusLabel(row.status)} tone={requestTone(row.status)} />,
          },
        ]}
        actions={(row) => [
          { label: "View", href: `/pro/dashboard/requests/${row.id}` },
          { label: "Discuss", href: `/pro/dashboard/requests/${row.id}?tab=messages` },
          ...(row.status === "viewed"
            ? []
            : [
                {
                  label: "Mark viewed",
                  onSelect: () => {
                    records.setStatus("request", row.id, "viewed");
                    toast.success("Request marked as viewed.");
                  },
                },
              ]),
          ...(row.status === "contacted"
            ? []
            : [
                {
                  label: "Mark contacted",
                  onSelect: () => {
                    records.setStatus("request", row.id, "contacted");
                    toast.success("Request marked as contacted.");
                  },
                },
              ]),
          ...(row.status === "estimate_sent"
            ? []
            : [
                {
                  label: "Mark estimate sent",
                  onSelect: () => {
                    records.setStatus("request", row.id, "estimate_sent");
                    toast.success("Request marked estimate sent.");
                  },
                },
              ]),
          ...(row.status === "declined"
            ? []
            : [
                {
                  label: "Decline",
                  onSelect: () => {
                    records.setStatus("request", row.id, "declined");
                    toast.success("Request declined.");
                  },
                },
              ]),
          archiveRowAction(records, "request", row.id, row.number),
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              records.remove("request", row.id);
              toast.success(`${row.number} removed from this board.`);
            },
          },
        ]}
      />
      <CreateLeadDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}
