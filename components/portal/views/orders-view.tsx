"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileEdit,
  MoreHorizontal,
  RefreshCw,
  Search,
  Wrench,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FilterTabs } from "@/components/portal/filter-tabs";
import { setPortalInboxCleared } from "@/components/portal/portal-inbox-clears";
import {
  AcceptOrderModal,
  ArriveOrderModal,
  CancelOrderModal,
  ChangeOrderModal,
  CompleteWorkModal,
  RejectOrderModal,
  StartWorkOrderModal,
  TransitOrderModal,
} from "@/components/portal/orders/order-action-modals";
import {
  formatOrderStatus,
  formatPaymentStatus,
  getOrderStatusTone,
  OrderStatusPill,
} from "@/components/portal/orders/order-status-pill";
import {
  PortalDataTable,
  type PortalTableAction,
  type PortalTableColumn,
} from "@/components/portal/portal-data-table";
import { PortalPage } from "@/components/portal/portal-page";
import { StatusPill } from "@/components/portal/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  acceptProviderOrder,
  getOrderApiScope,
  setOrderApiScope,
  type OrderApiScope,
  arriveProviderOrder,
  cancelProviderOrder,
  clearProviderOrdersError,
  completeProviderOrder,
  fetchProviderOrders,
  proposeChangeOrder,
  providerOrdersPageCacheKey,
  rejectProviderOrder,
  selectProviderOrdersShowLoader,
  setProviderOrdersPage,
  setProviderOrdersSearch,
  setProviderOrdersStatus,
  startWorkProviderOrder,
  transitProviderOrder,
} from "@/store/providerOrdersSlice";
import type { ProviderOrder } from "@/lib/types/provider-order";

const SEARCH_DEBOUNCE_MS = 400;

const ORDER_FILTERS = [
  { value: "", label: "All" },
  { value: "BOOKING_REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  // "In Transit" / "Arrived" tabs removed: the crew now just clocks in on site (job flow), so
  // orders go Confirmed → In Progress. Older orders in those states still show under All.
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CHANGE_ORDER_PENDING", label: "Change Orders" },
  { value: "WORK_COMPLETED", label: "Completed" },
  { value: "SETTLED", label: "Settled" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * `viewer`: "provider" = the Pro's Fixed service orders; "technician" / "contractor" = the orders
 * assigned to the signed-in employee / contractor in their portal (same table, their API, no
 * accept / decline / cancel or payout).
 */
/** "Mike R., Bright Electric" — assigned employees then contractors. */
function crewNames(row: ProviderOrder) {
  return [...(row.crew?.employees || []), ...(row.crew?.contractors || [])]
    .map((member) => member.name)
    .filter(Boolean)
    .join(", ");
}

export function OrdersView({ viewer = "provider" }: { viewer?: OrderApiScope } = {}) {
  // Before any fetch below: point the order thunks at this portal's API.
  if (getOrderApiScope() !== viewer) setOrderApiScope(viewer);
  const isPro = viewer === "provider";
  const basePath =
    viewer === "technician" ? "/technical/orders" : viewer === "contractor" ? "/contractor/orders" : "/pro/dashboard/orders";
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status") ?? "";

  const dispatch = useAppDispatch();
  const providerOrders = useAppSelector((state) => state.providerOrders);
  const {
    items,
    pagesCache,
    page,
    limit,
    total,
    totalPages,
    search,
    statusFilter,
    loading,
    mutating,
    actionLoading,
    error,
  } = providerOrders ?? {
    items: [],
    pagesCache: {},
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    search: "",
    statusFilter: "",
    loading: false,
    mutating: false,
    actionLoading: {},
    error: null,
  };
  const softLoader = useAppSelector(selectProviderOrdersShowLoader);

  const [searchInput, setSearchInput] = useState(search);
  const [actionLoadingState, setActionLoadingState] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMountRef = useRef(true);
  const prevQueryRef = useRef({
    page,
    search,
    status: statusFilter,
    limit,
  });

  const cacheKey = providerOrdersPageCacheKey(statusFilter, search, page, limit);
  const hasCache =
    Array.isArray(pagesCache?.[cacheKey]) && pagesCache[cacheKey]!.length > 0;

  // Active target order for modal actions
  const [activeModal, setActiveModal] = useState<
    | "accept"
    | "reject"
    | "transit"
    | "arrive"
    | "startWork"
    | "changeOrder"
    | "complete"
    | "cancel"
    | null
  >(null);
  const [modalTargetOrder, setModalTargetOrder] = useState<ProviderOrder | null>(
    null,
  );

  // Sync search input with Redux search
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Opening Fixed service orders clears the sidebar badge locally — no ack API.
  useEffect(() => {
    if (!isPro) return;
    setPortalInboxCleared("orders", true);
    window.dispatchEvent(
      new CustomEvent("rs-realtime", { detail: { type: "ORDERS_TAB_OPENED" } }),
    );
  }, [isPro]);

  // Sync URL tab status with Redux statusFilter
  useEffect(() => {
    if (urlStatus !== statusFilter) {
      const nextKey = providerOrdersPageCacheKey(urlStatus, search, 1, limit);
      const nextHasCache =
        Array.isArray(pagesCache?.[nextKey]) && pagesCache[nextKey]!.length > 0;
      if (!nextHasCache) setActionLoadingState(true);
      dispatch(setProviderOrdersStatus(urlStatus));
    }
  }, [urlStatus, statusFilter, search, limit, pagesCache, dispatch]);

  const refreshOrders = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? true;
      if (showLoading) setActionLoadingState(true);
      try {
        await dispatch(
          fetchProviderOrders({
            page,
            limit,
            status: statusFilter,
            search,
            force: true,
          }),
        ).unwrap();
      } catch (err) {
        toast.error(
          typeof err === "string"
            ? err
            : err instanceof Error
              ? err.message
              : "Could not load fixed service orders.",
        );
      } finally {
        setActionLoadingState(false);
      }
    },
    [dispatch, page, limit, statusFilter, search],
  );

  // Cache-aware refresh: silent when returning with data; loading on first visit /
  // empty cache / search-filter-page changes. (Same pattern as Leads.)
  useEffect(() => {
    // Wait until the URL tab is synced into Redux — fetching the old filter first
    // raced the new one (two lists answering each other in a loop).
    if (urlStatus !== statusFilter) return;
    const prev = prevQueryRef.current;
    const queryChanged =
      !isFirstMountRef.current &&
      (prev.page !== page ||
        prev.search !== search ||
        prev.status !== statusFilter ||
        prev.limit !== limit);
    prevQueryRef.current = { page, search, status: statusFilter, limit };

    const cached = pagesCache?.[cacheKey];
    const hasData = Array.isArray(cached) && cached.length > 0;
    const showLoading = queryChanged || !hasData;

    if (isFirstMountRef.current) isFirstMountRef.current = false;

    void refreshOrders({ showLoading });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when query identity changes
  }, [page, limit, statusFilter, search, cacheKey, refreshOrders, urlStatus]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Handle errors
  useEffect(() => {
    if (error && !loading && !mutating) {
      toast.error(error);
      dispatch(clearProviderOrdersError());
    }
  }, [dispatch, error, loading, mutating]);

  const handleRefresh = () => {
    void refreshOrders({ showLoading: !hasCache && items.length === 0 });
    toast.success("Orders refreshed.");
  };

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActionLoadingState(true);
      dispatch(setProviderOrdersSearch(value));
    }, SEARCH_DEBOUNCE_MS);
  }

  function onPageChange(nextPage: number) {
    if (nextPage === page) return;
    const nextKey = providerOrdersPageCacheKey(
      statusFilter,
      search,
      nextPage,
      limit,
    );
    const nextHasCache =
      Array.isArray(pagesCache?.[nextKey]) && pagesCache[nextKey]!.length > 0;
    if (!nextHasCache) setActionLoadingState(true);
    dispatch(setProviderOrdersPage(nextPage));
  }

  const handleOpenModal = (
    type:
      | "accept"
      | "reject"
      | "transit"
      | "arrive"
      | "startWork"
      | "changeOrder"
      | "complete"
      | "cancel",
    order: ProviderOrder,
  ) => {
    setModalTargetOrder(order);
    setActiveModal(type);
  };

  // Modal execution dispatches
  const handleAcceptConfirm = async () => {
    if (!modalTargetOrder) return;
    const res = await dispatch(acceptProviderOrder(modalTargetOrder.id));
    if (acceptProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      rejectProviderOrder({
        id: modalTargetOrder.id,
        reason,
        rejectionReason: reason,
      }),
    );
    if (rejectProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleTransitConfirm = async (coords: [number, number]) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      transitProviderOrder({
        id: modalTargetOrder.id,
        startCoordinates: coords,
      }),
    );
    if (transitProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleArriveConfirm = async (coords: [number, number]) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      arriveProviderOrder({
        id: modalTargetOrder.id,
        coordinates: coords,
      }),
    );
    if (arriveProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleStartWorkConfirm = async () => {
    if (!modalTargetOrder) return;
    const res = await dispatch(startWorkProviderOrder(modalTargetOrder.id));
    if (startWorkProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleChangeOrderConfirm = async (payload: {
    description: string;
    reason: string;
    additionalAmount: number;
    evidencePhotos: string[];
  }) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      proposeChangeOrder({
        id: modalTargetOrder.id,
        ...payload,
      }),
    );
    if (proposeChangeOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleCompleteConfirm = async (payload: {
    completionNotes: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      completeProviderOrder({
        id: modalTargetOrder.id,
        ...payload,
      }),
    );
    if (completeProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!modalTargetOrder) return;
    const res = await dispatch(
      cancelProviderOrder({
        id: modalTargetOrder.id,
        reason,
      }),
    );
    if (cancelProviderOrder.fulfilled.match(res)) {
      toast.success(res.payload.message);
      setActiveModal(null);
    }
  };

  // Table Columns
  const columns: PortalTableColumn<ProviderOrder>[] = [
    {
      id: "orderNumber",
      header: "Order #",
      sortValue: (row) => row.orderNumber,
      cell: (row) => (
        <div>
          <Link
            href={`${basePath}/${row.id}`}
            className="text-left font-mono font-semibold text-primary hover:underline"
          >
            {row.orderNumber || row.id.slice(-8).toUpperCase()}
          </Link>
          <p className="text-[11px] text-muted-foreground">
            {row.booking?.startTime
              ? formatDate(row.booking.startTime)
              : formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service & Scope",
      sortValue: (row) => row.service?.title || "",
      cell: (row) => (
        <div className="space-y-0.5 max-w-xs">
          <p className="font-medium text-foreground line-clamp-1">
            {row.service?.title || "Operational Service"}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {row.service?.category
              ? `${row.service.category}${row.service.subcategory ? ` · ${row.service.subcategory}` : ""}`
              : "General Service"}
          </p>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (row) => row.customer?.name || "",
      cell: (row) => (
        <p className="font-medium text-foreground">
          {row.customer?.name || "Customer"}
        </p>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      sortValue: (row) => row.customer?.phone || "",
      searchValue: (row) => row.customer?.phone || "",
      cell: (row) =>
        row.customer?.phone ? (
          <a href={`tel:${row.customer.phone}`} className="whitespace-nowrap hover:text-primary hover:underline">
            {row.customer.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "location",
      header: "Property Address",
      cell: (row) => (
        <div className="space-y-0.5 text-xs max-w-xs">
          <p className="text-foreground line-clamp-1">
            {row.address?.street || "On-site address"}
          </p>
          <p className="text-muted-foreground">
            {row.address?.city}{row.address?.state ? `, ${row.address.state}` : ""}{row.address?.zip ? ` ${row.address.zip}` : ""}
          </p>
        </div>
      ),
    },
    ...(isPro
      ? [
          {
            id: "crew",
            header: "Assigned",
            sortValue: (row: ProviderOrder) => crewNames(row) || "",
            cell: (row: ProviderOrder) => {
              const names = crewNames(row);
              return names ? (
                <span className="line-clamp-1 max-w-40 text-xs font-medium text-foreground">{names}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              );
            },
          } satisfies PortalTableColumn<ProviderOrder>,
        ]
      : []),
    {
      id: "pricing",
      header: "Total Payout",
      sortValue: (row) => row.pricing?.totalAmount || 0,
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">
            ${row.pricing?.totalAmount?.toFixed(2) || "0.00"}
          </span>
          <p className="text-[11px] text-muted-foreground">
            {formatPaymentStatus(row.payment?.status) || row.pricing?.currency || "USD"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => (
        <OrderStatusPill status={row.displayStatus || row.status} />
      ),
    },
    {
      id: "action",
      header: "Quick Action",
      cell: (row) => {
        const isActionLoading = Boolean(actionLoading[row.id]);

        switch (row.status) {
          case "BOOKING_REQUESTED":
            if (!isPro) {
              return (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Clock className="size-3" /> Awaiting the office
                </span>
              );
            }
            return (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => handleOpenModal("accept", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <CheckCircle2 className="size-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenModal("reject", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  Decline
                </Button>
              </div>
            );

          // The Pro assigns & manages; Depart / Arrive / Start / Complete / Change order are the
          // assigned crew's (Clock In on site in their portal). Previous: those buttons here.
          case "CONFIRMED":
          case "IN_TRANSIT":
          case "ARRIVED":
            return crewNames(row) ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Clock className="size-3" /> Waiting for crew
              </span>
            ) : (
              <div onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" asChild className="h-7 gap-1 px-2.5 text-xs">
                  <Link href={`${basePath}/${row.id}`}>
                    <UserPlus className="size-3" /> Assign
                  </Link>
                </Button>
              </div>
            );

          case "IN_PROGRESS":
            // Crew marked it complete → the Pro reviews the proof (approve → customer, reject → re-work).
            if (row.crewCompletion?.status === "pending") {
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" asChild className="h-7 gap-1 bg-amber-600 px-2.5 text-xs text-white hover:bg-amber-700">
                    <Link href={`${basePath}/${row.id}?tab=requests`}>
                      <CheckCircle2 className="size-3" /> Review completion
                    </Link>
                  </Button>
                </div>
              );
            }
            return (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700">
                <Clock className="size-3" /> Work in progress
              </span>
            );

          case "CHANGE_ORDER_PENDING":
            return (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                <Clock className="size-3" /> Pending Customer
              </span>
            );

          // Completed → invoice → paid → customer sign-off (like a job). Previous: always "Awaiting Sign-off".
          case "WORK_COMPLETED":
            if (!row.invoice) {
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" asChild className="h-7 gap-1 bg-[#003F7D] px-2.5 text-xs text-white hover:bg-[#003F7D]/90">
                    <Link href={`${basePath}/${row.id}`}>
                      <FileCheck className="size-3" /> Convert to invoice
                    </Link>
                  </Button>
                </div>
              );
            }
            return (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="size-3" />{" "}
                {row.invoice.status === "paid"
                  ? "Awaiting sign-off"
                  : row.invoice.status === "draft"
                    ? "Invoice draft — send it"
                    : "Awaiting payment"}
              </span>
            );

          case "SETTLED":
            return (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                Settled & Paid
              </span>
            );

          case "CANCELLED":
            return (
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <XCircle className="size-3" /> Cancelled
              </span>
            );

          default:
            return (
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                <Link href={`${basePath}/${row.id}`}>
                  View
                </Link>
              </Button>
            );
        }
      },
    },
  ];

  const visibleColumns = isPro ? columns : columns.filter((column) => column.id !== "pricing");

  // Row Dropdown Actions
  const tableActions = (row: ProviderOrder): PortalTableAction<ProviderOrder>[] => {
    const list: PortalTableAction<ProviderOrder>[] = [
      {
        label: "View details",
        href: `${basePath}/${row.id}`,
      },
    ];

    if (isPro && ["CONFIRMED", "IN_TRANSIT"].includes(row.status)) {
      list.push({
        label: "Emergency Cancel Order",
        variant: "destructive",
        onSelect: () => handleOpenModal("cancel", row),
      });
    }

    return list;
  };

  return (
    <PortalPage
      eyebrow={isPro ? "Work / Fixed service orders" : "Work / My orders"}
      title={isPro ? `Fixed service orders (${total})` : `My fixed service orders (${total})`}
      description={
        isPro
          ? "Accept bookings, assign an employee or contractor, and follow each order through to completion."
          : "Fixed-price orders the office assigned to you. Depart, check in on site, raise change orders and submit completion proof."
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={actionLoadingState && items.length === 0}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw
            className={`size-3.5 ${actionLoadingState && items.length === 0 ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      }
    >
      {/* Rest-of-app Standard Filter Tabs */}
      <FilterTabs
        baseHref={basePath}
        value={urlStatus}
        options={ORDER_FILTERS}
      />

      {/* Main Data Table — identical layout to Requests & Jobs boards */}
      <PortalDataTable
        rows={items}
        rowKey={(row) => row.id}
        rowHref={(row) => `${basePath}/${row.id}`}
        columns={visibleColumns}
        actions={tableActions}
        filename={isPro ? "provider-orders" : "my-orders"}
        searchPlaceholder="Search orders, customers, addresses..."
        empty={loading ? "Refreshing…" : "No operational orders found in this view."}
        loading={
          actionLoadingState ||
          (softLoader && !hasCache && items.length === 0)
        }
        serverPagination={{
          page,
          pageSize: limit,
          total,
          totalPages,
          onPageChange,
          search: searchInput,
          onSearchChange,
        }}
      />

      {/* Action Modals */}
      <AcceptOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "accept"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleAcceptConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <RejectOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "reject"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleRejectConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <TransitOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "transit"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleTransitConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <ArriveOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "arrive"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleArriveConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <StartWorkOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "startWork"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleStartWorkConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <ChangeOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "changeOrder"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleChangeOrderConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <CompleteWorkModal
        order={modalTargetOrder}
        isOpen={activeModal === "complete"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleCompleteConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />

      <CancelOrderModal
        order={modalTargetOrder}
        isOpen={activeModal === "cancel"}
        onClose={() => setActiveModal(null)}
        onConfirm={handleCancelConfirm}
        loading={modalTargetOrder ? Boolean(actionLoading[modalTargetOrder.id]) : false}
      />
    </PortalPage>
  );
}
