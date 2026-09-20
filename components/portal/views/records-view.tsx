"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  archiveRowAction,
  ConfirmArchiveDialog,
} from "@/components/portal/archive-control";
import {
  CreateEstimateDialog,
  CreateJobDialog,
} from "@/components/portal/create-work-dialogs";
import { buildEstimateSnapshot } from "@/components/portal/share-estimate-panel";
import {
  shareTokenFor,
  shareUrlFor,
  useEstimateShare,
} from "@/components/portal/use-estimate-share";
import { showApiErrorToast } from "@/components/api/apiFuntions";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { DeleteConfirmDialog } from "@/components/portal/delete-confirm-dialog";
import { ApplyPaymentDialog } from "@/components/portal/invoice-file";
import { invoiceBoardColumns } from "@/components/portal/invoice-columns";
import { jobBoardColumns } from "@/components/portal/job-columns";
import { paymentBoardColumns } from "@/components/portal/payment-columns";
import { PortalDataTable } from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { useCrmDirectory } from "@/components/portal/use-crm-directory";
import { usePortalCrew } from "@/components/portal/use-portal-crew";
import { usePortalRecords } from "@/components/portal/use-portal-records";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import {
  clearEstimatesError,
  fetchEstimates,
  invalidateEstimatesCache,
  patchEstimateLocally,
  removeEstimateLocally,
  setEstimatesPage,
  setEstimatesSearch,
  setEstimatesStatus,
} from "@/store/estimatesSlice";
import {
  clearJobsError,
  convertJobToInvoiceRecord,
  deleteJobRecord,
  fetchJobs,
  invalidateJobsCache,
  JOBS_DEFAULT_LIMIT,
  patchJobArchive,
  patchJobStatus,
  setJobsListFilter,
  setJobsPage,
  setJobsSearch,
} from "@/store/jobsSlice";
import {
  clearInvoicesError,
  deleteInvoiceRecord,
  fetchInvoices,
  INVOICES_DEFAULT_LIMIT,
  patchInvoiceArchive,
  patchInvoiceStatus,
  setInvoicesListFilter,
  setInvoicesPage,
  setInvoicesSearch,
} from "@/store/invoicesSlice";
import {
  deleteEstimate,
  queryEstimates,
  shareEstimate,
  updateEstimateStatus,
} from "@/lib/api/crm-client";
import { crmCustomerName } from "@/lib/data/crm-people";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ESTIMATE_STATUS_FILTERS,
  estimateCanShare,
  estimateCustomerName,
  estimateDisplayName,
  estimateStatusLabel,
  estimateStatusTone,
  getPortalCustomerName,
  INVOICE_BOARD_FILTERS,
  invoiceMatchesBoardFilter,
  JOB_STATUS_FILTERS,
  PAYMENT_BOARD_FILTERS,
  paymentMatchesBoardFilter,
  paymentNumber,
  withArchiveFilter,
} from "@/lib/data/portal";
import { formatDate, formatMoney } from "@/lib/format";
import type { Estimate, Invoice, Job } from "@/lib/types";

type EstimateRow = Estimate & { customerName: string };

export function EstimatesView() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status") ?? "";
  const { session, provider, requests } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const share = useEstimateShare();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<EstimateRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  // Controlled search input — updated immediately on keypress
  const [searchInput, setSearchInput] = useState("");
  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const slice = useAppSelector((state) => state.estimates);
  const { items, page, limit, total, totalPages, search, loading, error } =
    slice ?? {
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      search: "",
      loading: true,
      error: null,
    };

  const allRequests = useMemo(
    () => records.mergeRequests(requests),
    [records, requests],
  );

  // Sync the visible input from Redux when navigating back to a cached query
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Load on mount, status change, page change, or search change
  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    setActionLoading(true);
    void dispatch(
      fetchEstimates({
        search,
        status: statusParam,
        force: true,
      }),
    ).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, statusParam, page, search]);

  // Debounced search: dispatches to slice (thunk checks pagesCache — no redundant API hits)
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setEstimatesSearch(value.trim()));
    }, 400);
  }

  function handlePageChange(nextPage: number) {
    if (nextPage === page) return;
    setActionLoading(true);
    dispatch(setEstimatesPage(nextPage));
  }

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!useApi || !error || loading) return;
    toast.error(error);
    dispatch(clearEstimatesError());
  }, [dispatch, error, loading, useApi]);

  const rows: EstimateRow[] = useMemo(() => {
    return items.map((item) => ({
      ...item,
      customerName: estimateCustomerName(item, customers, allRequests),
    }));
  }, [allRequests, customers, items]);

  const tableLoading =
    actionLoading || (useApi ? loading && items.length === 0 : false);

  return (
    <PortalPage
      eyebrow="Estimates"
      title={`Estimates (${useApi ? total : rows.length})`}
      description="Site visit or write in the office, finalize, send for signature, then start the job."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create estimate
        </Button>
      }
    >
      <CreateEstimateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PortalDataTable
        filename="estimates"
        countLabel="Estimates"
        searchPlaceholder="Search quotes"
        loading={tableLoading}
        serverPagination={
          useApi
            ? {
                page,
                pageSize: limit,
                total,
                totalPages,
                onPageChange: handlePageChange,
                search: searchInput,
                onSearchChange: handleSearchChange,
              }
            : undefined
        }
        toolbar={
          <div className="h-8.5 w-40 sm:w-44">
            <Select
              disabled={tableLoading}
              value={statusParam || "__all__"}
              onValueChange={(value) => {
                const next = value === "__all__" ? "" : value;
                router.replace(
                  next
                    ? `/pro/dashboard/estimates?status=${next}`
                    : "/pro/dashboard/estimates",
                );
              }}
            >
              <SelectTrigger
                id="estimates-status-filter"
                aria-label="Filter by status"
                className="h-full w-full text-xs"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[160px]"
              >
                {withArchiveFilter(ESTIMATE_STATUS_FILTERS).map((option) => (
                  <SelectItem
                    key={option.label}
                    value={option.value || "__all__"}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/estimates/${row.id}`}
        empty={
          statusParam && statusParam !== "archived"
            ? "No estimates match this status."
            : "No estimates yet."
        }
        columns={[
          {
            id: "number",
            header: "Quote #",
            sortValue: (row) => row.number,
            searchValue: (row) => row.number,
            exportValue: (row) => row.number,
            cell: (row) => (
              <Link
                href={`/pro/dashboard/estimates/${row.id}`}
                className="font-medium text-primary hover:underline"
              >
                {row.number}
              </Link>
            ),
          },
          {
            id: "name",
            header: "Estimate name",
            sortValue: (row) => estimateDisplayName(row),
            searchValue: (row) => estimateDisplayName(row),
            exportValue: (row) => estimateDisplayName(row),
            cell: (row) => (
              <Link
                href={`/pro/dashboard/estimates/${row.id}`}
                className="text-primary hover:underline"
              >
                {estimateDisplayName(row)}
              </Link>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortValue: (row) =>
              row.customerName ||
              estimateCustomerName(row, customers, allRequests),
            searchValue: (row) =>
              row.customerName ||
              estimateCustomerName(row, customers, allRequests),
            exportValue: (row) =>
              row.customerName ||
              estimateCustomerName(row, customers, allRequests),
            cell: (row) => (
              <Link
                href={`/pro/dashboard/customers/${row.customerId}`}
                className="text-primary hover:underline"
              >
                {row.customerName ||
                  estimateCustomerName(row, customers, allRequests)}
              </Link>
            ),
          },
          {
            id: "street",
            header: "Job address",
            sortValue: (row) => row.propertyAddress.street,
            searchValue: (row) =>
              `${row.propertyAddress.street} ${row.propertyAddress.city} ${row.propertyAddress.zip}`,
            exportValue: (row) => row.propertyAddress.street,
            cell: (row) => row.propertyAddress.street,
          },
          {
            id: "city",
            header: "City",
            sortValue: (row) => row.propertyAddress.city,
            searchValue: (row) => row.propertyAddress.city,
            exportValue: (row) => row.propertyAddress.city,
            cell: (row) => row.propertyAddress.city,
          },
          {
            id: "issued",
            header: "Issued",
            sortValue: (row) => row.issuedAt,
            searchValue: (row) => formatDate(row.issuedAt),
            exportValue: (row) => formatDate(row.issuedAt),
            cell: (row) => formatDate(row.issuedAt),
          },
          {
            id: "expires",
            header: "Expires",
            sortValue: (row) => row.expiresAt ?? "",
            searchValue: (row) =>
              row.expiresAt ? formatDate(row.expiresAt) : "",
            exportValue: (row) =>
              row.expiresAt ? formatDate(row.expiresAt) : "",
            cell: (row) => (row.expiresAt ? formatDate(row.expiresAt) : "—"),
          },
          {
            id: "subtotal",
            header: "Subtotal",
            sortValue: (row) => row.subtotal,
            searchValue: (row) => formatMoney(row.subtotal),
            exportValue: (row) => formatMoney(row.subtotal),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.subtotal),
          },
          {
            id: "tax",
            header: "Tax",
            sortValue: (row) => row.tax,
            searchValue: (row) => formatMoney(row.tax),
            exportValue: (row) => formatMoney(row.tax),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.tax),
          },
          {
            id: "total",
            header: "Total",
            sortValue: (row) => row.total,
            searchValue: (row) => formatMoney(row.total),
            exportValue: (row) => formatMoney(row.total),
            className: "tabular-nums",
            cell: (row) => formatMoney(row.total),
          },
          {
            id: "status",
            header: "Status",
            sortValue: (row) => row.status,
            searchValue: (row) => estimateStatusLabel(row.status),
            exportValue: (row) => estimateStatusLabel(row.status),
            cell: (row) => (
              <StatusPill
                label={estimateStatusLabel(row.status)}
                className={estimateStatusTone(row.status)}
              />
            ),
          },
        ]}
        actions={(row) => {
          const isSent = row.status === "sent";
          const isAccepted = row.status === "accepted";
          const isFinalized = row.status === "finalized";
          const isDraftLike =
            row.status === "draft" ||
            row.status === "site_visit" ||
            row.status === "inspected" ||
            row.status === "changes_requested";
          const isRejected = row.status === "rejected";

          return [
            { label: "View", href: `/pro/dashboard/estimates/${row.id}` },
            ...(row.status === "site_visit"
              ? [
                  {
                    label: "Open site visit",
                    href: `/pro/dashboard/estimates/${row.id}?tab=visit`,
                  },
                ]
              : []),
            ...(isSent || isAccepted
              ? [
                  {
                    label: "Copy customer link",
                    onSelect: async () => {
                      try {
                        let linkUrl = "";

                        // 1. Use shareToken already present on the row (fastest, no API call)
                        if (row.shareToken) {
                          linkUrl = shareUrlFor(row.shareToken);
                        }

                        // 2. Fall back to locally-cached snapshot token
                        if (!linkUrl) {
                          const localToken = share.snapshotForEstimate(
                            row.id,
                          )?.token;
                          if (localToken) {
                            linkUrl = shareUrlFor(localToken);
                          }
                        }

                        // 3. Last resort: call the API to generate / fetch the token
                        if (!linkUrl && useApi) {
                          try {
                            const res = await shareEstimate(row.id);
                            if (res?.shareToken) {
                              linkUrl = shareUrlFor(res.shareToken);
                            } else if (res?.shareUrl) {
                              linkUrl = res.shareUrl.startsWith("http")
                                ? res.shareUrl
                                : shareUrlFor(res.shareUrl.replace(/^\//, ""));
                            }
                          } catch {
                            // ignore — show error below
                          }
                        }

                        if (linkUrl) {
                          await navigator.clipboard.writeText(linkUrl);
                          toast.success("Customer link copied to clipboard.");
                        } else {
                          toast.error(
                            "Share token is not available for this estimate.",
                          );
                        }
                      } catch {
                        toast.error("Could not copy link to clipboard.");
                      }
                    },
                  },
                ]
              : []),
            ...(isDraftLike || isRejected
              ? [
                  {
                    label: "Finalize",
                    onSelect: async () => {
                      try {
                        if (useApi) {
                          await updateEstimateStatus(row.id, "finalized");
                        }
                        records.setStatus("estimate", row.id, "finalized");
                        dispatch(
                          patchEstimateLocally({
                            id: row.id,
                            patch: { status: "finalized" },
                          }),
                        );
                        toast.success(`${row.number} finalized.`);
                      } catch (err) {
                        showApiErrorToast(err, "Failed to finalize estimate.");
                      }
                    },
                  },
                ]
              : []),
            ...(isFinalized
              ? [
                  {
                    label: "Mark sent",
                    onSelect: async () => {
                      try {
                        if (useApi) {
                          await updateEstimateStatus(row.id, "sent");
                        }
                        records.setStatus("estimate", row.id, "sent");
                        dispatch(
                          patchEstimateLocally({
                            id: row.id,
                            patch: { status: "sent" },
                          }),
                        );
                        toast.success("Estimate marked sent.");
                      } catch (err) {
                        showApiErrorToast(
                          err,
                          "Failed to mark estimate as sent.",
                        );
                      }
                    },
                  },
                ]
              : []),
            ...(isSent
              ? [
                  {
                    label: "Mark accepted",
                    onSelect: async () => {
                      try {
                        if (useApi) {
                          await updateEstimateStatus(row.id, "accepted");
                        }
                        records.setStatus("estimate", row.id, "accepted");
                        dispatch(
                          patchEstimateLocally({
                            id: row.id,
                            patch: { status: "accepted" },
                          }),
                        );
                        toast.success("Estimate marked accepted.");
                      } catch (err) {
                        showApiErrorToast(
                          err,
                          "Failed to mark estimate as accepted.",
                        );
                      }
                    },
                  },
                ]
              : []),
            ...(isFinalized || isSent
              ? [
                  {
                    label: "Mark rejected",
                    onSelect: async () => {
                      try {
                        if (useApi) {
                          await updateEstimateStatus(row.id, "rejected");
                        }
                        records.setStatus("estimate", row.id, "rejected");
                        dispatch(
                          patchEstimateLocally({
                            id: row.id,
                            patch: { status: "rejected" },
                          }),
                        );
                        toast.success("Estimate marked rejected.");
                      } catch (err) {
                        showApiErrorToast(
                          err,
                          "Failed to mark estimate as rejected.",
                        );
                      }
                    },
                  },
                ]
              : []),
            ...(isAccepted
              ? [
                  {
                    label: "Convert to job",
                    href: `/pro/dashboard/estimates/${row.id}`,
                  },
                ]
              : []),
            archiveRowAction(records, "estimate", row.id, row.number, () =>
              setArchiveTarget(row),
            ),
          ];
        }}
      />
      <ConfirmArchiveDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!archiving) setArchiveTarget(null);
        }}
        kind="estimate"
        number={archiveTarget?.number}
        loading={archiving}
        onConfirm={async () => {
          if (!archiveTarget) return;
          setArchiving(true);
          try {
            await records.archive("estimate", archiveTarget.id);
            dispatch(
              patchEstimateLocally({
                id: archiveTarget.id,
                patch: { isArchived: true, isArchieved: true },
              }),
            );
            toast.success(`${archiveTarget.number} archived.`);
            setArchiveTarget(null);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not archive this estimate.",
            );
          } finally {
            setArchiving(false);
          }
        }}
      />
    </PortalPage>
  );
}

export function JobsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status") ?? "";
  const archivedOnly = statusParam === "archived";
  const listFilter = statusParam as "" | Job["status"] | "archived";
  const dispatch = useAppDispatch();
  const { provider, estimates, requests, invoices } = usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const { events, employeeLabel } = usePortalCrew();
  const records = usePortalRecords();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Job | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const slice = useAppSelector((s) => s.jobs);
  const {
    items: reduxItems,
    loading,
    total,
    totalPages,
    page,
    search: reduxSearch,
    error,
  } = slice ?? {
    items: [],
    loading: true,
    total: 0,
    totalPages: 1,
    page: 1,
    search: "",
    error: null,
  };

  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(reduxSearch);
  }, [reduxSearch]);

  useEffect(() => {
    dispatch(setJobsListFilter(listFilter));
  }, [dispatch, listFilter]);

  useEffect(() => {
    let cancelled = false;
    setActionLoading(true);
    void dispatch(fetchJobs()).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, page, reduxSearch, slice?.status, slice?.isArchived]);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!error || loading) return;
    toast.error(error);
    dispatch(clearJobsError());
  }, [dispatch, error, loading]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setJobsSearch(value.trim()));
    }, 350);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === page) return;
    setActionLoading(true);
    dispatch(setJobsPage(newPage));
  };

  const handleStatusAction = async (
    id: string,
    status: Job["status"],
    label: string,
  ) => {
    setActionLoading(true);
    try {
      await dispatch(patchJobStatus({ id, status })).unwrap();
      toast.success(label);
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Could not update job status.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, number: string) => {
    setActionLoading(true);
    try {
      await dispatch(deleteJobRecord(id)).unwrap();
      toast.success(`${number} deleted. The source estimate can be converted again.`);
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Could not delete this job.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  async function handleConvert(row: Job) {
    if (convertingId) return;
    if (row.invoiceId) {
      router.push(`/pro/dashboard/invoices/${row.invoiceId}`);
      return;
    }
    if (row.status === "invoiced" || row.status === "paid") {
      toast.error("This job is marked invoiced but has no invoice link yet.");
      router.push(`/pro/dashboard/jobs/${row.id}`);
      return;
    }
    setConvertingId(row.id);
    try {
      const { invoice } = await dispatch(
        convertJobToInvoiceRecord(row.id),
      ).unwrap();
      toast.success(`${invoice.number || "Invoice"} drafted from ${row.number}.`);
      router.push(`/pro/dashboard/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Could not convert this job.",
      );
    } finally {
      setConvertingId(null);
    }
  }

  const allEstimates = useMemo(
    () => records.mergeEstimates(estimates),
    [records, estimates],
  );
  const allInvoices = useMemo(
    () => records.mergeInvoices(invoices),
    [records, invoices],
  );

  const rows = reduxItems;
  const tableLoading = actionLoading || (loading && rows.length === 0);

  return (
    <PortalPage
      eyebrow="Field work"
      title={`Jobs (${total})`}
      description="Approved estimates become jobs. Fixed services booked on the website skip the estimate and land here as work ready to start."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create job
        </Button>
      }
    >
      <CreateJobDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            dispatch(invalidateJobsCache());
            void dispatch(fetchJobs({ force: true }));
          }
        }}
      />
      <PortalDataTable
        filename="jobs"
        countLabel="Jobs"
        searchPlaceholder="Search jobs"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/jobs/${row.id}`}
        loading={tableLoading}
        empty={
          archivedOnly
            ? "No archived jobs."
            : statusParam
              ? "No jobs match this status."
              : "No jobs yet."
        }
        serverPagination={{
          page,
          pageSize: JOBS_DEFAULT_LIMIT,
          total,
          totalPages,
          onPageChange: handlePageChange,
          search: searchInput,
          onSearchChange: handleSearch,
        }}
        toolbar={
          <div className="h-8.5 w-40 sm:w-52">
            <Select
              disabled={tableLoading}
              value={statusParam || "__all__"}
              onValueChange={(value) => {
                const next = value === "__all__" ? "" : value;
                router.replace(
                  next
                    ? `/pro/dashboard/jobs?status=${next}`
                    : "/pro/dashboard/jobs",
                );
              }}
            >
              <SelectTrigger
                id="jobs-status-filter"
                aria-label="Filter by status"
                className="h-full w-full text-xs"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[160px]"
              >
                {withArchiveFilter(JOB_STATUS_FILTERS).map((option) => (
                  <SelectItem
                    key={option.label}
                    value={option.value || "__all__"}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        columns={jobBoardColumns({
          estimates: allEstimates,
          requests,
          invoices: allInvoices,
          events,
          employeeLabel,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match
              ? crmCustomerName(match)
              : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => {
          const archived = Boolean(row.isArchived) || records.isArchived("job", row.id);
          const alreadyInvoiced = Boolean(
            row.invoiceId || row.status === "invoiced" || row.status === "paid",
          );
          const isFinished =
            row.status === "completed" ||
            row.status === "invoiced" ||
            row.status === "paid" ||
            row.status === "cancelled";
          return [
            { label: "View", href: `/pro/dashboard/jobs/${row.id}` },
            alreadyInvoiced
              ? {
                  label: row.invoiceId ? "Open invoice" : "Invoiced",
                  href: row.invoiceId
                    ? `/pro/dashboard/invoices/${row.invoiceId}`
                    : `/pro/dashboard/jobs/${row.id}`,
                }
              : {
                  label:
                    convertingId === row.id ? "Converting…" : "Convert to invoice",
                  onSelect: () => void handleConvert(row),
                },
            { label: "Assign on calendar", href: "/pro/dashboard/schedule" },
            ...(archived || isFinished || row.status === "in_progress"
              ? []
              : [
                  {
                    label: "Start job",
                    onSelect: () => {
                      void handleStatusAction(row.id, "in_progress", "Job marked in progress.");
                    },
                  },
                ]),
            ...(archived || isFinished
              ? []
              : [
                  {
                    label: "Complete",
                    onSelect: () => {
                      void handleStatusAction(row.id, "completed", "Job marked completed.");
                    },
                  },
                ]),
            ...(archived || isFinished || row.status === "on_hold"
              ? []
              : [
                  {
                    label: "Put on hold",
                    onSelect: () => {
                      void handleStatusAction(row.id, "on_hold", "Job put on hold.");
                    },
                  },
                ]),
            ...(archived || isFinished
              ? []
              : [
                  {
                    label: "Cancel",
                    onSelect: () => {
                      void handleStatusAction(row.id, "cancelled", "Job cancelled.");
                    },
                  },
                ]),
            archived
              ? {
                  label: restoringId === row.id ? "Restoring…" : "Restore",
                  onSelect: () => {
                    if (restoringId) return;
                    void (async () => {
                      setRestoringId(row.id);
                      try {
                        await dispatch(
                          patchJobArchive({ id: row.id, isArchived: false }),
                        ).unwrap();
                        toast.success(`${row.number} restored.`);
                      } catch (err) {
                        toast.error(
                          typeof err === "string"
                            ? err
                            : "Could not restore this job.",
                        );
                      } finally {
                        setRestoringId(null);
                      }
                    })();
                  },
                }
              : archiveRowAction(
                  records,
                  "job",
                  row.id,
                  row.number,
                  () => setArchiveTarget(row),
                ),
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => {
                void handleDelete(row.id, row.number);
              },
            },
          ];
        }}
      />
      <ConfirmArchiveDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!archiving && !open) setArchiveTarget(null);
        }}
        kind="job"
        number={archiveTarget?.number}
        loading={archiving}
        onConfirm={() => {
          if (!archiveTarget || archiving) return;
          void (async () => {
            setArchiving(true);
            try {
              await dispatch(
                patchJobArchive({ id: archiveTarget.id, isArchived: true }),
              ).unwrap();
              toast.success(`${archiveTarget.number} archived.`);
              setArchiveTarget(null);
            } catch (err) {
              toast.error(
                typeof err === "string"
                  ? err
                  : "Could not archive this job.",
              );
            } finally {
              setArchiving(false);
            }
          })();
        }}
      />
    </PortalPage>
  );
}


export function InvoicesView() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status") ?? "";
  const archivedOnly = statusParam === "archived";
  const listFilter =
    statusParam === "payments"
      ? ""
      : (statusParam as
          | ""
          | "unpaid"
          | "paid"
          | "overdue"
          | "draft"
          | "partially_paid"
          | "cancelled"
          | "archived");

  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const useApi =
    auth.hydrated &&
    Boolean(auth.token) &&
    (user?.role === "provider" || auth.role === "provider");

  const { invoices, jobs, estimates, requests, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Invoice | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slice = useAppSelector((state) => state.invoices);
  const {
    items,
    page,
    limit,
    total,
    totalPages,
    search,
    loading,
    error,
  } = slice ?? {
    items: [],
    page: 1,
    limit: INVOICES_DEFAULT_LIMIT,
    total: 0,
    totalPages: 1,
    search: "",
    loading: true,
    error: null,
  };
  const [searchInput, setSearchInput] = useState(search);

  const allJobs = useMemo(() => records.mergeJobs(jobs), [records, jobs]);
  const allEstimates = useMemo(
    () => records.mergeEstimates(estimates),
    [records, estimates],
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!useApi) return;
    dispatch(setInvoicesListFilter(listFilter));
  }, [dispatch, useApi, listFilter]);

  useEffect(() => {
    if (!useApi) return;
    let cancelled = false;
    setActionLoading(true);
    void dispatch(fetchInvoices()).finally(() => {
      if (!cancelled) setActionLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, useApi, page, search, slice?.status, slice?.isArchived]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!useApi || !error || loading) return;
    toast.error(error);
    dispatch(clearInvoicesError());
  }, [dispatch, error, loading, useApi]);

  const localRows = useMemo(
    () =>
      records
        .listed("invoice", records.mergeInvoices(invoices), archivedOnly)
        .map((item) => ({
          ...item,
          status: records.statusOf("invoice", item.id, item.status),
        }))
        .filter(
          (item) => archivedOnly || invoiceMatchesBoardFilter(item, statusParam),
        ),
    [archivedOnly, invoices, records, statusParam],
  );

  const rows = useApi ? items : localRows;
  const tableLoading =
    actionLoading || (useApi && loading && items.length === 0);

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (!useApi) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoading(true);
      dispatch(setInvoicesSearch(value.trim()));
    }, 350);
  }

  function onPageChange(nextPage: number) {
    if (!useApi || nextPage === page) return;
    setActionLoading(true);
    dispatch(setInvoicesPage(nextPage));
  }

  async function handleSetStatus(row: Invoice, next: Invoice["status"]) {
    if (row.status === next) return;
    setBusyIds((prev) => [...prev, row.id]);
    try {
      if (useApi) {
        await dispatch(patchInvoiceStatus({ id: row.id, status: next })).unwrap();
      } else {
        await records.setStatus("invoice", row.id, next);
      }
      toast.success(`Invoice marked ${next.replaceAll("_", " ")}.`);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to update invoice status.");
    } finally {
      setBusyIds((prev) => prev.filter((id) => id !== row.id));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      if (useApi) {
        await dispatch(deleteInvoiceRecord(deleting.id)).unwrap();
      } else {
        records.remove("invoice", deleting.id);
      }
      toast.success(`${deleting.number} deleted.`);
      setDeleting(null);
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Could not delete invoice.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <PortalPage
      eyebrow="Billing"
      title={`Invoices${useApi ? ` (${total})` : ""}`}
      description="Each invoice keeps the original estimate plus approved extras."
    >
      <PortalDataTable
        filename="invoices"
        countLabel="Invoices"
        searchPlaceholder="Search by invoice # or job #"
        loading={tableLoading}
        busyRowIds={busyIds}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/invoices/${row.id}`}
        pageSize={useApi ? limit : undefined}
        empty={
          search
            ? "No invoices match this search."
            : archivedOnly
              ? "No archived invoices."
              : statusParam
                ? "No invoices match this status."
                : "No records found."
        }
        serverPagination={
          useApi
            ? {
                page,
                pageSize: limit,
                total,
                totalPages,
                onPageChange,
                search: searchInput,
                onSearchChange,
              }
            : undefined
        }
        toolbar={
          <div className="h-8.5 w-40 sm:w-44">
            <Select
              disabled={tableLoading}
              value={statusParam || "__all__"}
              onValueChange={(value) => {
                if (value === "payments") {
                  router.replace("/pro/dashboard/payments");
                  return;
                }
                const next = value === "__all__" ? "" : value;
                router.replace(
                  next
                    ? `/pro/dashboard/invoices?status=${next}`
                    : "/pro/dashboard/invoices",
                );
              }}
            >
              <SelectTrigger
                id="invoices-status-filter"
                aria-label="Filter by status"
                className="h-full w-full text-xs"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                className="z-[100] w-[var(--radix-select-trigger-width)] min-w-[160px]"
              >
                {withArchiveFilter([
                  ...INVOICE_BOARD_FILTERS,
                  { value: "payments", label: "Payments" },
                ]).map((option) => (
                  <SelectItem
                    key={option.label}
                    value={option.value || "__all__"}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        columns={invoiceBoardColumns({
          jobs: allJobs,
          estimates: allEstimates,
          requests,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match
              ? crmCustomerName(match)
              : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => {
          const archived =
            Boolean(row.isArchived) || records.isArchived("invoice", row.id);
          return [
            { label: "View", href: `/pro/dashboard/invoices/${row.id}` },
            ...(row.balanceDue > 0
              ? [
                  {
                    label: "Apply payment",
                    onSelect: () => setPaying(row),
                  },
                ]
              : []),
            ...(row.jobId && allJobs.some((job) => job.id === row.jobId)
              ? [{ label: "Open job", href: `/pro/dashboard/jobs/${row.jobId}` }]
              : []),
            ...(archived || row.status === "sent" || row.status === "paid"
              ? []
              : [
                  {
                    label: "Mark sent",
                    onSelect: () => void handleSetStatus(row, "sent"),
                  },
                ]),
            ...(archived || row.status === "paid"
              ? []
              : [
                  {
                    label: "Mark paid",
                    onSelect: () => void handleSetStatus(row, "paid"),
                  },
                ]),
            ...(archived || row.status === "overdue" || row.status === "paid"
              ? []
              : [
                  {
                    label: "Mark overdue",
                    onSelect: () => void handleSetStatus(row, "overdue"),
                  },
                ]),
            archived
              ? {
                  label: restoringId === row.id ? "Restoring…" : "Restore",
                  onSelect: () => {
                    if (restoringId) return;
                    void (async () => {
                      setRestoringId(row.id);
                      try {
                        if (useApi) {
                          await dispatch(
                            patchInvoiceArchive({
                              id: row.id,
                              isArchived: false,
                            }),
                          ).unwrap();
                        } else {
                          await records.unarchive("invoice", row.id);
                        }
                        toast.success(`${row.number} restored.`);
                      } catch (err) {
                        toast.error(
                          typeof err === "string"
                            ? err
                            : "Could not restore this invoice.",
                        );
                      } finally {
                        setRestoringId(null);
                      }
                    })();
                  },
                }
              : archiveRowAction(
                  records,
                  "invoice",
                  row.id,
                  row.number,
                  () => setArchiveTarget(row),
                ),
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => setDeleting(row),
            },
          ];
        }}
      />
      <ConfirmArchiveDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!archiving && !open) setArchiveTarget(null);
        }}
        kind="invoice"
        number={archiveTarget?.number}
        loading={archiving}
        onConfirm={() => {
          if (!archiveTarget || archiving) return;
          void (async () => {
            setArchiving(true);
            try {
              if (useApi) {
                await dispatch(
                  patchInvoiceArchive({
                    id: archiveTarget.id,
                    isArchived: true,
                  }),
                ).unwrap();
              } else {
                await records.archive("invoice", archiveTarget.id);
              }
              toast.success(`${archiveTarget.number} archived.`);
              setArchiveTarget(null);
            } catch (err) {
              toast.error(
                typeof err === "string"
                  ? err
                  : "Could not archive this invoice.",
              );
            } finally {
              setArchiving(false);
            }
          })();
        }}
      />
      <ApplyPaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => {
          if (!open) {
            setPaying(null);
          }
        }}
        invoice={paying}
        onPaid={() => {
          if (useApi) void dispatch(fetchInvoices({ force: true }));
        }}
      />
      <DeleteConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title="Delete Invoice"
        description={
          deleting
            ? `Delete ${deleting.number}? Unpaid invoices can be removed. Invoices with payments cannot be deleted.`
            : "Delete this invoice?"
        }
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </PortalPage>
  );
}

export function PaymentsView() {
  const status = useSearchParams().get("status") ?? "";
  const { payments, invoices, jobs, estimates, requests, provider } =
    usePortalWorkspace();
  const { customers } = useCrmDirectory();
  const records = usePortalRecords();
  const archivedOnly = status === "archived";
  const allInvoices = useMemo(
    () => records.mergeInvoices(invoices),
    [records, invoices],
  );
  const allJobs = useMemo(() => records.mergeJobs(jobs), [records, jobs]);
  const allEstimates = useMemo(
    () => records.mergeEstimates(estimates),
    [records, estimates],
  );
  const rows = useMemo(
    () =>
      records
        .listed("payment", records.mergePayments(payments), archivedOnly)
        .map((item) => ({
          ...item,
          status: records.statusOf("payment", item.id, item.status),
        }))
        .filter(
          (item) => archivedOnly || paymentMatchesBoardFilter(item, status),
        ),
    [archivedOnly, payments, records, status],
  );

  return (
    <PortalPage
      eyebrow="Money in"
      title="Payments"
      description="Deposits, progress payments, and completion balances recorded against invoices."
    >
      <FilterTabs
        baseHref="/pro/dashboard/payments"
        value={status}
        options={withArchiveFilter(PAYMENT_BOARD_FILTERS)}
      />
      <PortalDataTable
        filename="payments"
        countLabel="Payments"
        searchPlaceholder="Search by payment #, invoice #, or job #"
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/payments/${row.id}`}
        columns={paymentBoardColumns({
          invoices: allInvoices,
          jobs: allJobs,
          estimates: allEstimates,
          requests,
          customerName: (customerId) => {
            const match = customers.find((item) => item.id === customerId);
            return match
              ? crmCustomerName(match)
              : getPortalCustomerName(provider, customerId);
          },
        })}
        actions={(row) => {
          const invoice = allInvoices.find((item) => item.id === row.invoiceId);
          const job = invoice
            ? allJobs.find((item) => item.id === invoice.jobId)
            : undefined;
          return [
            { label: "View", href: `/pro/dashboard/payments/${row.id}` },
            ...(invoice
              ? [
                  {
                    label: "Open invoice",
                    href: `/pro/dashboard/invoices/${invoice.id}`,
                  },
                ]
              : []),
            ...(job
              ? [{ label: "Open job", href: `/pro/dashboard/jobs/${job.id}` }]
              : []),
            archiveRowAction(records, "payment", row.id, paymentNumber(row)),
            {
              label: "Delete",
              variant: "destructive",
              onSelect: () => {
                records.remove("payment", row.id);
                toast.success(`${paymentNumber(row)} removed from this board.`);
              },
            },
          ];
        }}
      />
    </PortalPage>
  );
}
