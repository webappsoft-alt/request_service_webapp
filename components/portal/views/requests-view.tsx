"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Eye,
  FileCheck,
  FilePlus2,
  FileText,
  MessageSquare,
  PhoneCall,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { archiveRowAction } from "@/components/portal/archive-control";
import { CreateLeadDialog } from "@/components/portal/create-work-dialogs";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { PortalDataTable, type PortalTableAction } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill, requestTone } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { markUnreadLeadNotificationsRead } from "@/lib/api/notifications-client";
import { ackInboxBadges } from "@/lib/api/crm-client";
import { setPortalInboxCleared } from "@/components/portal/portal-inbox-clears";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchRequests,
  fetchRequestsSummary,
  invalidateRequestsCache,
  patchLeadStatus,
  REQUESTS_DEFAULT_LIMIT,
  requestsCacheKey,
  setRequestStatusLocal,
  setRequestsPage,
  setRequestsSearch,
  setRequestsStatus,
} from "@/store/requestsSlice";
import { crmCustomerName } from "@/lib/data/crm-people";
import { requestStatusLabel, withArchiveFilter, type PortalRequest } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";
import type { RequestStatus } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 400;

function sourceLabel(source?: string) {
  if (source === "profile_view") return "Profile view";
  if (source === "fixed_service_view") return "Service view";
  if (source === "direct_message") return "Direct chat";
  if (source === "quote_request") return "Lead";
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
  { value: "scheduled", label: "Scheduled" },
  { value: "closed", label: "History" },
];

export function RequestsView() {
  const dispatch = useAppDispatch();
  const reduxRequests = useAppSelector((state) => state.requests);
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const { requests, estimates, jobs } = usePortalWorkspace();
  const crm = useCrmApiData();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(reduxRequests.search || "");
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedLeadBadgesRef = useRef(false);
  const archivedOnly = status === "archived";

  const page = reduxRequests.page || 1;
  const limit = reduxRequests.limit || REQUESTS_DEFAULT_LIMIT;
  const total = reduxRequests.total || 0;
  const totalPages = Math.max(1, reduxRequests.totalPages || 1);
  const search = reduxRequests.search || "";

  // Map filter-tab values to API status when needed. "All" = no status filter.
  const apiStatus = archivedOnly ? "" : status;

  const cacheKey = requestsCacheKey(apiStatus, search, page, limit);
  const cachedItems = reduxRequests.pagesCache[cacheKey];
  const items =
    Array.isArray(cachedItems) && cachedItems.length > 0
      ? cachedItems
      : reduxRequests.items.length > 0
        ? reduxRequests.items
        : [];
  const hasCache = Array.isArray(cachedItems) && cachedItems.length > 0;

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if ((reduxRequests.status || "") !== apiStatus) {
      dispatch(setRequestsStatus(apiStatus));
    }
  }, [apiStatus, dispatch, reduxRequests.status]);

  const updateLeadStatus = useCallback(
    async (id: string, newStatus: RequestStatus, message: string) => {
      dispatch(setRequestStatusLocal({ id, status: newStatus }));
      try {
        await dispatch(patchLeadStatus({ id, status: newStatus })).unwrap();
        await records.setStatus("request", id, newStatus);
        toast.success(message);
      } catch {
        toast.error("Failed to update status.");
      }
    },
    [dispatch, records],
  );

  const refreshLeads = useCallback(
    async (force = true) => {
      setActionLoading(true);
      try {
        if (force) dispatch(invalidateRequestsCache());
        await Promise.allSettled([
          dispatch(
            fetchRequests({
              page,
              limit,
              status: apiStatus,
              search,
              force: true,
              silent: true,
            }),
          ).unwrap(),
          dispatch(fetchRequestsSummary({ silent: true })).unwrap(),
        ]);
      } catch (error) {
        toast.error(
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "Could not load leads.",
        );
      } finally {
        setActionLoading(false);
      }
    },
    [dispatch, page, limit, apiStatus, search],
  );

  // Always revalidate from the API so new quote leads appear immediately.
  useEffect(() => {
    void refreshLeads(true);
  }, [refreshLeads]);

  // Opening Leads ACKs the sidebar badge (persists across refresh) — never changes lead status.
  useEffect(() => {
    if (clearedLeadBadgesRef.current) return;
    clearedLeadBadgesRef.current = true;
    setPortalInboxCleared("leads", true);
    window.dispatchEvent(
      new CustomEvent("rs-realtime", { detail: { type: "LEADS_TAB_OPENED" } }),
    );
    void markUnreadLeadNotificationsRead().catch(() => undefined);
    void ackInboxBadges(["leads"]).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleLeadStatus = (event: Event) => {
      const custom = event as CustomEvent<{ id?: string; status?: string }>;
      const detail = custom?.detail;
      if (detail?.id && detail?.status) {
        dispatch(
          setRequestStatusLocal({
            id: detail.id,
            status: detail.status as PortalRequest["status"],
          }),
        );
      }
    };

    const handleRealtime = (event: Event) => {
      const custom = event as CustomEvent<{ type?: string; payload?: any }>;
      const detail = custom?.detail;
      const type = detail?.type;

      if (type === "LEAD_STATUS_UPDATED" || type === "REQUEST_STATUS_UPDATED") {
        const id = String(detail?.payload?.id || detail?.payload?.requestId || "").trim();
        const nextStatus = String(detail?.payload?.status || "").trim();
        const scheduledDate = detail?.payload?.scheduledDate
          ? String(detail.payload.scheduledDate)
          : undefined;
        if (id && nextStatus) {
          dispatch(
            setRequestStatusLocal({
              id,
              status: nextStatus as PortalRequest["status"],
              ...(scheduledDate ? { scheduledDate } : {}),
            }),
          );
        }
        // Do not force a full list View refetch — local cache is the source of truth here.
        return;
      }

      // Only refetch list on actual lead creation/mutation events, NOT on chat/inbox badge noise
      if (
        type === "LEAD_CREATED" ||
        type === "ESTIMATE_ACCEPTED" ||
        type === "ORDER_UPDATED"
      ) {
        void refreshLeads(true);
      }
    };

    window.addEventListener("rs-lead-status", handleLeadStatus);
    window.addEventListener("rs-realtime", handleRealtime);
    return () => {
      window.removeEventListener("rs-lead-status", handleLeadStatus);
      window.removeEventListener("rs-realtime", handleRealtime);
    };
  }, [dispatch, refreshLeads]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setRequestsSearch(value.trim()));
    }, SEARCH_DEBOUNCE_MS);
  }

  function handlePageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setRequestsPage(nextPage));
  }

  const source = items.length > 0 ? items : records.mergeRequests(requests);

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

  // Server already filters by status/search; only apply archive listing locally.
  const rows = records.listed("request", enrichedSource, archivedOnly);

  const summary = reduxRequests.summary;
  const newLeadsCount =
    summary?.newLeads ??
    source.filter((r) => r.status === "new" || r.status === "viewed").length;
  const activeLeadsCount =
    summary?.activeLeads ??
    source.filter(
      (r) =>
        r.status === "contacted" ||
        r.status === "estimate_sent" ||
        r.status === "accepted",
    ).length;
  const convertedLeadsCount =
    summary?.convertedLeads ??
    source.filter(
      (r) =>
        r.status === "converted_to_job" ||
        r.status === "declined" ||
        r.status === "closed",
    ).length;
  const unreadChatsCount =
    summary?.unreadChats ??
    source.reduce((acc, r) => acc + (r.unreadMessagesCount || 0), 0);

  const tableLoading =
    actionLoading ||
    (reduxRequests.loading && !hasCache && rows.length === 0);

  return (
    <PortalPage
      eyebrow="Work / Leads"
      title={`Leads (${total || rows.length})`}
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
        loading={tableLoading}
        pageSize={limit}
        serverPagination={{
          page,
          pageSize: limit,
          total,
          totalPages,
          onPageChange: handlePageChange,
          search: searchInput,
          onSearchChange: handleSearchChange,
        }}
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
                      Viewed {row.viewCount} times
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
              const chatHref = row.chatThreadId
                ? `/pro/dashboard/messages?thread=${row.chatThreadId}`
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
                  ) : row.hasActiveChat || row.chatThreadId ? (
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
          const chatHref = row.chatThreadId
            ? `/pro/dashboard/messages?thread=${row.chatThreadId}`
            : `/pro/dashboard/requests/${row.id}?tab=messages`;

          const relatedEstimate =
            crm.estimates.find((e) => e.requestId === row.id) ??
            estimates.find((e) => e.requestId === row.id);
          const relatedJob = relatedEstimate
            ? (crm.jobs.find((j) => j.estimateId === relatedEstimate.id) ??
               jobs.find((j) => j.estimateId === relatedEstimate.id))
            : undefined;

          const estimateHref = relatedEstimate
            ? `/pro/dashboard/estimates/${relatedEstimate.id}`
            : `/pro/dashboard/requests/${row.id}?tab=estimates`;
          const jobHref = relatedJob
            ? `/pro/dashboard/jobs/${relatedJob.id}`
            : `/pro/dashboard/requests/${row.id}?tab=jobs`;

          const hasEstimate =
            Boolean(relatedEstimate) ||
            row.status === "estimate_sent" ||
            row.status === "accepted" ||
            row.status === "converted_to_job";

          const baseActions: PortalTableAction<PortalRequest>[] = [
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
          ];

          const statusActions: PortalTableAction<PortalRequest>[] = [];

          switch (row.status) {
            case "new":
              statusActions.push(
                {
                  label: "Mark viewed",
                  icon: <Eye className="size-3.5" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "viewed", "Request marked as viewed."),
                },
                {
                  label: "Mark contacted",
                  icon: <PhoneCall className="size-3.5" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "contacted", "Request marked as contacted."),
                },
                {
                  label: "Convert to Estimate",
                  href: `/pro/dashboard/requests/${row.id}?convert=1`,
                  icon: <FilePlus2 className="size-3.5 text-[#003F7D]" />,
                },
                {
                  label: "Decline",
                  icon: <XCircle className="size-3.5 text-red-500" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "declined", "Request declined."),
                },
              );
              break;

            case "viewed":
              statusActions.push(
                {
                  label: "Mark contacted",
                  icon: <PhoneCall className="size-3.5" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "contacted", "Request marked as contacted."),
                },
                {
                  label: "Convert to Estimate",
                  href: `/pro/dashboard/requests/${row.id}?convert=1`,
                  icon: <FilePlus2 className="size-3.5 text-[#003F7D]" />,
                },
                {
                  label: "Decline",
                  icon: <XCircle className="size-3.5 text-red-500" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "declined", "Request declined."),
                },
              );
              break;

            case "contacted":
            case "scheduled":
              if (hasEstimate) {
                statusActions.push(
                  {
                    label: "View Estimate",
                    href: estimateHref,
                    icon: <FileCheck className="size-3.5 text-emerald-600" />,
                  },
                  {
                    label: "Mark estimate sent",
                    icon: <FileCheck className="size-3.5 text-emerald-600" />,
                    onSelect: () =>
                      updateLeadStatus(
                        row.id,
                        "estimate_sent",
                        "Request marked estimate sent.",
                      ),
                  },
                );
              } else {
                statusActions.push({
                  label: "Convert to Estimate",
                  href: `/pro/dashboard/requests/${row.id}?convert=1`,
                  icon: <FilePlus2 className="size-3.5 text-[#003F7D]" />,
                });
              }
              statusActions.push({
                label: "Decline",
                icon: <XCircle className="size-3.5 text-red-500" />,
                onSelect: () =>
                  updateLeadStatus(row.id, "declined", "Request declined."),
              });
              break;

            case "estimate_sent":
              statusActions.push(
                {
                  label: "View Estimate",
                  href: estimateHref,
                  icon: <FileCheck className="size-3.5 text-emerald-600" />,
                },
                {
                  label: "Mark accepted",
                  icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
                  onSelect: () =>
                    updateLeadStatus(
                      row.id,
                      "accepted",
                      "Proposal marked as accepted by customer.",
                    ),
                },
                {
                  label: "Convert to Job",
                  href: relatedEstimate
                    ? `/pro/dashboard/estimates/${relatedEstimate.id}`
                    : `/pro/dashboard/requests/${row.id}?tab=jobs`,
                  icon: <Briefcase className="size-3.5 text-[#003F7D]" />,
                },
                {
                  label: "Decline",
                  icon: <XCircle className="size-3.5 text-red-500" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "declined", "Lead marked as declined."),
                },
              );
              break;

            case "accepted":
              statusActions.push(
                {
                  label: "View Estimate",
                  href: estimateHref,
                  icon: <FileCheck className="size-3.5 text-emerald-600" />,
                },
                {
                  label: "Convert to Job",
                  href: relatedEstimate
                    ? `/pro/dashboard/estimates/${relatedEstimate.id}`
                    : `/pro/dashboard/requests/${row.id}?tab=jobs`,
                  icon: <Briefcase className="size-3.5 text-[#003F7D]" />,
                },
                {
                  label: "Mark closed",
                  icon: <CheckCircle2 className="size-3.5 text-slate-500" />,
                  onSelect: () =>
                    updateLeadStatus(row.id, "closed", "Lead closed."),
                },
              );
              break;

            case "converted_to_job":
              statusActions.push({
                label: "View Job",
                href: jobHref,
                icon: <Briefcase className="size-3.5 text-[#003F7D]" />,
              });
              if (hasEstimate) {
                statusActions.push({
                  label: "View Estimate",
                  href: estimateHref,
                  icon: <FileText className="size-3.5" />,
                });
              }
              statusActions.push({
                label: "Mark closed",
                icon: <CheckCircle2 className="size-3.5 text-slate-500" />,
                onSelect: () =>
                  updateLeadStatus(row.id, "closed", "Lead closed."),
              });
              break;

            case "declined":
            case "closed":
              statusActions.push({
                label: "Reopen lead",
                icon: <RotateCcw className="size-3.5 text-blue-600" />,
                onSelect: () =>
                  updateLeadStatus(row.id, "contacted", "Lead reopened as active."),
              });
              break;

            default:
              statusActions.push({
                label: "Mark contacted",
                icon: <PhoneCall className="size-3.5" />,
                onSelect: () =>
                  updateLeadStatus(row.id, "contacted", "Request marked as contacted."),
              });
              break;
          }

          return [
            ...baseActions,
            ...statusActions,
            archiveRowAction(records, "request", row.id, row.number),
          ];
        }}
      />
      <CreateLeadDialog open={open} onOpenChange={setOpen} />
    </PortalPage>
  );
}
