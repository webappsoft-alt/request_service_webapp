"use client";

import { useEffect, useRef, useState } from "react";
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
  MapPin,
  MoreHorizontal,
  Navigation,
  Play,
  RefreshCw,
  Search,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FilterTabs } from "@/components/portal/filter-tabs";
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
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CHANGE_ORDER_PENDING", label: "Change Orders" },
  { value: "WORK_COMPLETED", label: "Completed" },
  { value: "SETTLED", label: "Settled" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function OrdersView() {
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

  // Sync URL tab status with Redux statusFilter
  useEffect(() => {
    if (urlStatus !== statusFilter) {
      const cacheKey = providerOrdersPageCacheKey(urlStatus, search, 1, limit);
      const hasCache = Boolean(pagesCache?.[cacheKey]);
      if (!hasCache) setActionLoadingState(true);
      dispatch(setProviderOrdersStatus(urlStatus));
    }
  }, [urlStatus, statusFilter, search, limit, pagesCache, dispatch]);

  // Fetch orders when page, search, limit, or statusFilter changes (cached thunks exit early)
  useEffect(() => {
    void dispatch(fetchProviderOrders());
  }, [dispatch, page, search, limit, statusFilter]);

  useEffect(() => {
    if (!loading) setActionLoadingState(false);
  }, [loading]);

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
    void dispatch(fetchProviderOrders({ force: true }));
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
    const cacheKey = providerOrdersPageCacheKey(statusFilter, search, nextPage, limit);
    const hasCache = Boolean(pagesCache?.[cacheKey]?.length);
    if (!hasCache) setActionLoadingState(true);
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
            href={`/pro/dashboard/orders/${row.id}`}
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
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            {row.customer?.name || "Customer"}
          </p>
          {row.customer?.phone ? (
            <p className="text-xs text-muted-foreground">
              {row.customer.phone}
            </p>
          ) : null}
        </div>
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
        <OrderStatusPill status={row.status} />
      ),
    },
    {
      id: "action",
      header: "Quick Action",
      cell: (row) => {
        const isActionLoading = Boolean(actionLoading[row.id]);

        switch (row.status) {
          case "BOOKING_REQUESTED":
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

          case "CONFIRMED":
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => handleOpenModal("transit", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                >
                  <Navigation className="size-3" /> Depart
                </Button>
              </div>
            );

          case "IN_TRANSIT":
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => handleOpenModal("arrive", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                >
                  <MapPin className="size-3" /> Arrive
                </Button>
              </div>
            );

          case "ARRIVED":
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => handleOpenModal("startWork", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2.5 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                >
                  <Play className="size-3" /> Start Work
                </Button>
              </div>
            );

          case "IN_PROGRESS":
            return (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  onClick={() => handleOpenModal("complete", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <CheckCircle2 className="size-3" /> Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenModal("changeOrder", row)}
                  disabled={isActionLoading}
                  className="h-7 px-2 text-xs"
                >
                  + Change
                </Button>
              </div>
            );

          case "CHANGE_ORDER_PENDING":
            return (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
                <Clock className="size-3" /> Pending Customer
              </span>
            );

          case "WORK_COMPLETED":
            return (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="size-3" /> Awaiting Sign-off
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
                <Link href={`/pro/dashboard/orders/${row.id}`}>
                  View
                </Link>
              </Button>
            );
        }
      },
    },
  ];

  // Row Dropdown Actions
  const tableActions = (row: ProviderOrder): PortalTableAction<ProviderOrder>[] => {
    const list: PortalTableAction<ProviderOrder>[] = [
      {
        label: "View details",
        href: `/pro/dashboard/orders/${row.id}`,
      },
    ];

    if (["CONFIRMED", "IN_TRANSIT"].includes(row.status)) {
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
      eyebrow="Work / Orders"
      title={`Orders (${total})`}
      description="Operational job orders assigned to you. Track status, navigation, arrival, and work execution."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-1.5 h-8 text-xs"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {/* Rest-of-app Standard Filter Tabs */}
      <FilterTabs
        baseHref="/pro/dashboard/orders"
        value={urlStatus}
        options={ORDER_FILTERS}
      />

      {/* Main Data Table — identical layout to Requests & Jobs boards */}
      <PortalDataTable
        rows={items}
        rowKey={(row) => row.id}
        rowHref={(row) => `/pro/dashboard/orders/${row.id}`}
        columns={columns}
        actions={tableActions}
        filename="provider-orders"
        searchPlaceholder="Search orders, customers, addresses..."
        empty={loading ? "Refreshing…" : "No operational orders found in this view."}
        loading={softLoader || actionLoadingState}
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
