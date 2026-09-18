"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FilePlus2, FileText, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { archiveRowAction } from "@/components/portal/archive-control";
import { CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { CRM_API_EVENT } from "@/components/portal/crm-data-provider";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useChatThreads } from "@/components/portal/use-chat-threads";
import { listRequests, updateRequestStatus } from "@/lib/api/crm-client";
import { crmCustomerName } from "@/lib/data/crm-people";
import { requestStatusLabel, withArchiveFilter, type PortalRequest } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";

function sourceLabel(source?: string) {
  if (source === "profile_view") return "Profile view";
  if (source === "fixed_service_view") return "Service view";
  if (source === "direct_message") return "Direct chat";
  if (source === "quote_request") return "Quote request";
  if (source === "phone") return "Phone";
  if (source === "walk_in") return "Walk-in";
  return source || "Direct";
}

function formatPreferredDate(dateStr?: string | null, windowStr?: string | null) {
  if (!dateStr || dateStr === "—") return <span className="text-muted-foreground">—</span>;
  const formatted = formatDate(dateStr);
  const cleanWindow = windowStr ? windowStr.replace(/_/g, " ") : null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium text-foreground">{formatted}</span>
      {cleanWindow ? (
        <span className="text-xs text-muted-foreground capitalize">
          {cleanWindow}
        </span>
      ) : null}
    </div>
  );
}

function formatReceivedDateTime(dateStr?: string | null) {
  if (!dateStr) return <span className="text-muted-foreground">—</span>;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return <span>{dateStr}</span>;
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
    const formattedTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-xs">{formattedDate}</span>
        <span className="text-[11px] text-muted-foreground">{formattedTime}</span>
      </div>
    );
  } catch {
    return <span>{dateStr}</span>;
  }
}

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
  const crm = useCrmApiData();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const { threads } = useChatThreads();
  const [open, setOpen] = useState(false);
  const [apiItems, setApiItems] = useState<PortalRequest[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const archivedOnly = status === "archived";

  const loadLeads = useCallback(async () => {
    let cancelled = false;
    setListLoading(true);
    try {
      const items = await listRequests({ silent: true, force: true });
      if (!cancelled) {
        setApiItems(items);
      }
    } catch (error) {
      if (!cancelled) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Could not load leads.",
        );
      }
    } finally {
      if (!cancelled) setListLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadLeads();
    };
    window.addEventListener(CRM_API_EVENT, handleRefresh);
    window.addEventListener("rs-realtime", handleRefresh);
    return () => {
      window.removeEventListener(CRM_API_EVENT, handleRefresh);
      window.removeEventListener("rs-realtime", handleRefresh);
    };
  }, [loadLeads]);

  const source = apiItems.length > 0 ? apiItems : records.mergeRequests(requests);

  const enrichedSource: PortalRequest[] = useMemo(() => {
    return source.map((lead) => {
      if (lead.customerName && lead.customerName !== "Customer") return lead;
      const matched = customers.find((c) => c.id === lead.customerId);
      if (matched) {
        return {
          ...lead,
          customerName: crmCustomerName(matched),
          customerEmail: lead.customerEmail || matched.email,
          customerPhone: lead.customerPhone || matched.phone || "",
        };
      }
      return lead;
    });
  }, [source, customers]);

  const rows = records
    .listed("request", enrichedSource, archivedOnly)
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
        loading={listLoading && rows.length === 0}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/requests/${row.id}`}
        columns={[
          {
            id: "number",
            header: "Request",
            sortValue: (row) => row.number,
            searchValue: (row) => `${row.number} ${row.channel} ${row.source ?? ""}`,
            exportValue: (row) => row.number,
            cell: (row) => (
              <div>
                <Link href={`/pro/dashboard/requests/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.number}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground capitalize">{row.channel}</span>
                  {row.source && row.source !== "quote_request" ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                      {sourceLabel(row.source)}
                    </span>
                  ) : null}
                  {typeof row.viewCount === "number" && row.viewCount > 1 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      {row.viewCount}x visits
                    </span>
                  ) : null}
                </div>
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) => row.customerName,
            searchValue: (row) => `${row.customerName} ${row.customerEmail}`,
            exportValue: (row) => row.customerName,
            cell: (row) => {
              const matchedThread = threads.find(
                (t) =>
                  t.id === row.chatThreadId ||
                  (row.id && t.requestId === row.id) ||
                  (row.customerEmail &&
                    t.customerEmail?.toLowerCase() === row.customerEmail.toLowerCase()),
              );
              const chatHref = matchedThread?.id
                ? `/pro/dashboard/messages?thread=${matchedThread.id}`
                : `/pro/dashboard/requests/${row.id}?tab=messages`;

              return (
                <div className="flex items-center gap-2">
                  {row.customerId ? (
                    <Link href={`/pro/dashboard/customers/${row.customerId}`} className="text-primary hover:underline">
                      {row.customerName}
                    </Link>
                  ) : (
                    <span>{row.customerName}</span>
                  )}
                  {typeof row.unreadMessagesCount === "number" && row.unreadMessagesCount > 0 ? (
                    <Link
                      href={chatHref}
                      className="inline-flex items-center gap-1 rounded-full bg-[#003F7D] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#003264]"
                      title="New unread messages"
                    >
                      <MessageSquare className="size-2.5" />
                      {row.unreadMessagesCount} new
                    </Link>
                  ) : row.hasActiveChat || row.chatThreadId || matchedThread ? (
                    <Link
                      href={chatHref}
                      title="Open chat conversation"
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#003F7D] hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                    >
                      <MessageSquare className="size-2.5" />
                      Chat
                    </Link>
                  ) : null}
                </div>
              );
            },
          },
          {
            id: "phone",
            header: "Phone",
            sortValue: (row) => row.customerPhone || "",
            searchValue: (row) => row.customerPhone || "",
            exportValue: (row) => row.customerPhone || "",
            cell: (row) => row.customerPhone || "—",
          },
          {
            id: "email",
            header: "Email",
            sortValue: (row) => row.customerEmail || "",
            searchValue: (row) => row.customerEmail || "",
            exportValue: (row) => row.customerEmail || "",
            cell: (row) => <span className="text-primary">{row.customerEmail || "—"}</span>,
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
                {row.neighborhood || row.city || "—"}
                {row.zip ? <p className="text-xs text-muted-foreground">{row.zip}</p> : null}
              </div>
            ),
          },
          {
            id: "window",
            header: "Preferred",
            sortValue: (row) => row.preferredDate ?? "",
            searchValue: (row) => `${row.preferredDate ? formatDate(row.preferredDate) : ""} ${row.preferredTimeWindow ?? ""}`,
            exportValue: (row) => row.preferredDate ? formatDate(row.preferredDate) : "—",
            cell: (row) => formatPreferredDate(row.preferredDate, row.preferredTimeWindow),
          },
          {
            id: "received",
            header: "Received",
            sortValue: (row) => row.createdAt,
            searchValue: (row) => `${formatDate(row.createdAt)} ${row.createdAt}`,
            exportValue: (row) => formatDate(row.createdAt),
            cell: (row) => formatReceivedDateTime(row.createdAt),
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
        actions={(row) => {
          const matchedThread = threads.find(
            (t) =>
              t.id === row.chatThreadId ||
              (row.id && t.requestId === row.id) ||
              (row.customerEmail &&
                t.customerEmail?.toLowerCase() === row.customerEmail.toLowerCase()),
          );
          const chatHref = matchedThread?.id
            ? `/pro/dashboard/messages?thread=${matchedThread.id}`
            : `/pro/dashboard/requests/${row.id}?tab=messages`;

          return [
            {
              label: "View",
              href: `/pro/dashboard/requests/${row.id}`,
              icon: <FileText className="size-3.5" />,
            },
            {
              label: row.unreadMessagesCount
                ? `Chat (${row.unreadMessagesCount} new)`
                : "Chat",
              href: chatHref,
              icon: <MessageSquare className="size-3.5 text-[#003F7D]" />,
              quick: true,
            },
            {
              label: "Convert to Estimate",
              href: `/pro/dashboard/requests/${row.id}?convert=1`,
              icon: <FilePlus2 className="size-3.5" />,
            },
          ...(row.status === "viewed"
            ? []
            : [
                {
                  label: "Mark viewed",
                  onSelect: async () => {
                    records.setStatus("request", row.id, "viewed");
                    setApiItems((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, status: "viewed" } : item)),
                    );
                    try {
                      await updateRequestStatus(row.id, "viewed");
                      crm.refresh({ silent: true });
                    } catch {
                      /* handled */
                    }
                    toast.success("Request marked as viewed.");
                  },
                },
              ]),
          ...(row.status === "contacted"
            ? []
            : [
                {
                  label: "Mark contacted",
                  onSelect: async () => {
                    records.setStatus("request", row.id, "contacted");
                    setApiItems((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, status: "contacted" } : item)),
                    );
                    try {
                      await updateRequestStatus(row.id, "contacted");
                      crm.refresh({ silent: true });
                    } catch {
                      /* handled */
                    }
                    toast.success("Request marked as contacted.");
                  },
                },
              ]),
          ...(row.status === "estimate_sent"
            ? []
            : [
                {
                  label: "Mark estimate sent",
                  onSelect: async () => {
                    records.setStatus("request", row.id, "estimate_sent");
                    setApiItems((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, status: "estimate_sent" } : item)),
                    );
                    try {
                      await updateRequestStatus(row.id, "estimate_sent");
                      crm.refresh({ silent: true });
                    } catch {
                      /* handled */
                    }
                    toast.success("Request marked estimate sent.");
                  },
                },
              ]),
          ...(row.status === "declined"
            ? []
            : [
                {
                  label: "Decline",
                  onSelect: async () => {
                    records.setStatus("request", row.id, "declined");
                    setApiItems((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, status: "declined" } : item)),
                    );
                    try {
                      await updateRequestStatus(row.id, "declined");
                      crm.refresh({ silent: true });
                    } catch {
                      /* handled */
                    }
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
        ];
      }}
      />
      <CreateLeadDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}
