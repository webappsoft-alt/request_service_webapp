import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  extractErrorMessage,
  getData,
  postData,
} from "@/components/api/apiFuntions";
import { bookingsApi, ordersApi } from "@/components/api/ApiRoutesFile";
import type {
  OrderCheckoutRequest,
  OrderCheckoutResult,
  SlotAvailabilityResponse,
  BookingSlot,
  CustomerOrderListItem,
  CustomerOrderDetail,
  CustomerOrdersListResult,
  OrdersPagination,
  ChangeOrderItem,
  LifecycleAuditEntry,
  CustomerOrderServiceSummary,
  CustomerOrderProviderSummary,
  CustomerOrderBookingSummary,
  OrderAddress,
  CompletionDetails,
} from "@/lib/types/order-booking";
import type { PendingFixedOrder } from "@/lib/booking/pending-fixed-order";

export const CUSTOMER_ORDERS_PAGE_LIMIT = 10;

type OrdersState = {
  availability: SlotAvailabilityResponse | null;
  availabilityLoading: boolean;
  availabilityError: string | null;
  checkoutLoading: boolean;
  checkoutError: string | null;
  lastCheckout: OrderCheckoutResult | null;
  /** In-session mirror of the pending checkout draft (also in sessionStorage). */
  pendingDraft: PendingFixedOrder | null;
  list: CustomerOrderListItem[];
  listPagination: OrdersPagination | null;
  listLoading: boolean;
  listError: string | null;
  listLoaded: boolean;
  listRequestKey: string | null;
  detail: CustomerOrderDetail | null;
  detailLoading: boolean;
  detailError: string | null;
};

const emptyPagination = (): OrdersPagination => ({
  page: 1,
  limit: CUSTOMER_ORDERS_PAGE_LIMIT,
  totalDocs: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
});

const initialState: OrdersState = {
  availability: null,
  availabilityLoading: false,
  availabilityError: null,
  checkoutLoading: false,
  checkoutError: null,
  lastCheckout: null,
  pendingDraft: null,
  list: [],
  listPagination: null,
  listLoading: false,
  listError: null,
  listLoaded: false,
  listRequestKey: null,
  detail: null,
  detailLoading: false,
  detailError: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseSlot(raw: unknown): BookingSlot | null {
  const record = asRecord(raw);
  if (!record) return null;
  const startTime =
    typeof record.startTime === "string" ? record.startTime : "";
  const endTime = typeof record.endTime === "string" ? record.endTime : "";
  if (!startTime || !endTime) return null;
  return {
    startTime,
    endTime,
    bufferEndTime:
      typeof record.bufferEndTime === "string"
        ? record.bufferEndTime
        : undefined,
    durationMinutes: toNumber(record.durationMinutes ?? record.duration, 60),
    bufferMinutes: toNumber(record.bufferMinutes, 30),
    isAvailable: Boolean(record.isAvailable),
    disabledReason:
      typeof record.disabledReason === "string"
        ? record.disabledReason
        : record.disabledReason == null
          ? null
          : String(record.disabledReason),
  };
}

function parseAvailability(response: unknown): SlotAvailabilityResponse {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const service = asRecord(data.service) ?? {};
  const provider = asRecord(data.provider) ?? {};
  const rawSlots = Array.isArray(data.slots) ? data.slots : [];
  const slots = rawSlots
    .map(parseSlot)
    .filter((slot): slot is BookingSlot => Boolean(slot));

  const durationFromSlots = slots.find(
    (slot) => slot.durationMinutes && slot.durationMinutes > 0,
  )?.durationMinutes;

  return {
    date: typeof data.date === "string" ? data.date : "",
    serviceId:
      (typeof data.serviceId === "string" && data.serviceId) ||
      (typeof service.id === "string" && service.id) ||
      "",
    providerId:
      (typeof data.providerId === "string" && data.providerId) ||
      (typeof provider.id === "string" && provider.id) ||
      undefined,
    duration: toNumber(data.duration ?? durationFromSlots, 60),
    bufferMinutes: toNumber(data.bufferMinutes, 30),
    timezone: typeof data.timezone === "string" ? data.timezone : undefined,
    slots,
    serviceName:
      typeof service.name === "string"
        ? service.name
        : typeof service.title === "string"
          ? service.title
          : undefined,
    basePrice:
      service.basePrice == null ? undefined : toNumber(service.basePrice, 0),
  };
}

function pickId(record: Record<string, unknown>): string {
  return (
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    ""
  );
}

function parseServiceSummary(
  raw: unknown,
): CustomerOrderServiceSummary | null {
  const record = asRecord(raw);
  if (!record) return null;
  const title =
    (typeof record.title === "string" && record.title) ||
    (typeof record.servicesName === "string" && record.servicesName) ||
    (typeof record.name === "string" && record.name) ||
    "";
  if (!title && !pickId(record)) return null;
  const categoryRaw = record.category ?? record.categoryName;
  const category =
    typeof categoryRaw === "string"
      ? categoryRaw
      : typeof asRecord(categoryRaw)?.name === "string"
        ? String(asRecord(categoryRaw)?.name)
        : undefined;
  const subcategoryRaw = record.subcategory ?? record.subcategoryName;
  const images = Array.isArray(record.images)
    ? record.images.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : undefined;
  const covered = Array.isArray(record.covered)
    ? record.covered.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : undefined;
  return {
    id: pickId(record) || undefined,
    title: title || "Service",
    category,
    subcategory:
      typeof subcategoryRaw === "string"
        ? subcategoryRaw
        : typeof asRecord(subcategoryRaw)?.name === "string"
          ? String(asRecord(subcategoryRaw)?.name)
          : undefined,
    unit: typeof record.unit === "string" ? record.unit : undefined,
    quantity:
      record.quantity == null
        ? undefined
        : typeof record.quantity === "number" || typeof record.quantity === "string"
          ? record.quantity
          : undefined,
    slug: typeof record.slug === "string" ? record.slug : undefined,
    images,
    covered,
    basePrice:
      record.basePrice == null ? undefined : toNumber(record.basePrice, 0),
  };
}

function parseProviderSummary(
  raw: unknown,
): CustomerOrderProviderSummary | null {
  if (typeof raw === "string" && raw.trim()) {
    return { id: raw.trim(), companyName: "Provider" };
  }
  const record = asRecord(raw);
  if (!record) return null;
  const companyName =
    (typeof record.companyName === "string" && record.companyName.trim()) ||
    (typeof record.name === "string" && record.name.trim()) ||
    "";
  if (!companyName && !pickId(record) && typeof record.phone !== "string") {
    return null;
  }
  return {
    id: pickId(record) || undefined,
    companyName: companyName || "Service provider",
    phone: typeof record.phone === "string" ? record.phone : undefined,
    email: typeof record.email === "string" ? record.email : undefined,
    slug: typeof record.slug === "string" ? record.slug : undefined,
    website:
      typeof record.website === "string" && record.website.trim()
        ? record.website.trim()
        : undefined,
    avatarUrl:
      (typeof record.avatarUrl === "string" && record.avatarUrl.trim()) ||
      (typeof record.avatar === "string" && record.avatar.trim()) ||
      (typeof record.image === "string" && record.image.trim()) ||
      undefined,
  };
}

function parseBookingSummary(
  raw: unknown,
): CustomerOrderBookingSummary | null {
  if (typeof raw === "string" && raw.trim()) {
    return { id: raw.trim(), startTime: "", endTime: "" };
  }
  const record = asRecord(raw);
  if (!record) return null;
  const startTime =
    typeof record.startTime === "string" ? record.startTime : "";
  const endTime = typeof record.endTime === "string" ? record.endTime : "";
  if (!startTime && !endTime && !pickId(record)) return null;
  return {
    id: pickId(record) || undefined,
    startTime,
    endTime,
    bufferEndTime:
      typeof record.bufferEndTime === "string"
        ? record.bufferEndTime
        : undefined,
    status: typeof record.status === "string" ? record.status : undefined,
    duration: toNumber(
      record.durationMinutes ?? record.duration,
      0,
    ) || undefined,
  };
}

function parseAddress(raw: unknown): Partial<OrderAddress> | null {
  const record = asRecord(raw);
  if (!record) return null;
  const locationRaw = asRecord(record.location);
  const coords = Array.isArray(locationRaw?.coordinates)
    ? (locationRaw.coordinates as number[])
    : null;
  return {
    street: typeof record.street === "string" ? record.street : undefined,
    unit: typeof record.unit === "string" ? record.unit : undefined,
    city: typeof record.city === "string" ? record.city : undefined,
    state: typeof record.state === "string" ? record.state : undefined,
    zip: typeof record.zip === "string" ? record.zip : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    location:
      coords && coords.length >= 2
        ? {
            type: "Point",
            coordinates: [toNumber(coords[0], 0), toNumber(coords[1], 0)],
          }
        : undefined,
  };
}

function parseChangeOrder(raw: unknown): ChangeOrderItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickId(record);
  if (!id) return null;
  const evidence = Array.isArray(record.evidenceImages)
    ? record.evidenceImages.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  return {
    id,
    description:
      typeof record.description === "string" ? record.description : "",
    additionalAmount: toNumber(record.additionalAmount, 0),
    evidenceImages: evidence,
    status: typeof record.status === "string" ? record.status : "PENDING",
    requestedAt:
      typeof record.requestedAt === "string" ? record.requestedAt : undefined,
    respondedAt:
      typeof record.respondedAt === "string"
        ? record.respondedAt
        : record.respondedAt == null
          ? null
          : undefined,
    customerNote:
      typeof record.customerNote === "string" ? record.customerNote : undefined,
  };
}

function parseLifecycleEntry(raw: unknown): LifecycleAuditEntry | null {
  const record = asRecord(raw);
  if (!record) return null;
  const toStatus =
    typeof record.toStatus === "string" ? record.toStatus : "";
  const timestamp =
    typeof record.timestamp === "string" ? record.timestamp : "";
  if (!toStatus && !timestamp) return null;
  return {
    fromStatus:
      typeof record.fromStatus === "string"
        ? record.fromStatus
        : record.fromStatus == null
          ? null
          : String(record.fromStatus),
    toStatus: toStatus || "UNKNOWN",
    timestamp,
    triggeredBy:
      typeof record.triggeredBy === "string" ? record.triggeredBy : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
  };
}

function parseCompletionDetails(raw: unknown): CompletionDetails | null {
  const record = asRecord(raw);
  if (!record) return null;
  const signOff = asRecord(record.customerSignOff);
  const proofImages = Array.isArray(record.proofOfWorkImages)
    ? record.proofOfWorkImages.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : [];
  const proofVideos = Array.isArray(record.proofOfWorkVideos)
    ? record.proofOfWorkVideos.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : undefined;
  return {
    completedAt:
      typeof record.completedAt === "string"
        ? record.completedAt
        : record.completedAt == null
          ? null
          : undefined,
    proofOfWorkImages: proofImages,
    proofOfWorkVideos: proofVideos,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    customerSignOff: signOff
      ? {
          confirmed: Boolean(signOff.confirmed),
          signedAt:
            typeof signOff.signedAt === "string"
              ? signOff.signedAt
              : signOff.signedAt == null
                ? null
                : undefined,
          signatureUrl:
            typeof signOff.signatureUrl === "string"
              ? signOff.signatureUrl
              : signOff.signatureUrl == null
                ? null
                : undefined,
          rating:
            signOff.rating == null ? null : toNumber(signOff.rating, 0),
          review:
            typeof signOff.review === "string" ? signOff.review : undefined,
        }
      : undefined,
  };
}

function parseOrderListItem(raw: unknown): CustomerOrderListItem | null {
  const record = asRecord(raw);
  if (!record) return null;
  const id = pickId(record);
  if (!id) return null;
  const pricing = asRecord(record.pricing) ?? {};
  const service =
    parseServiceSummary(record.serviceSnapshot) ||
    parseServiceSummary(record.service);
  const provider =
    parseProviderSummary(record.provider) ||
    parseProviderSummary(record.providerId);
  const booking =
    parseBookingSummary(record.booking) ||
    parseBookingSummary(record.bookingId);

  return {
    id,
    orderNumber:
      typeof record.orderNumber === "string" ? record.orderNumber : "",
    status:
      (typeof record.status === "string" && record.status) || "BOOKING_REQUESTED",
    pricing: {
      totalAmount: toNumber(pricing.totalAmount, 0),
      currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
      basePrice:
        pricing.basePrice == null ? undefined : toNumber(pricing.basePrice, 0),
      subtotal:
        pricing.subtotal == null ? undefined : toNumber(pricing.subtotal, 0),
    },
    service,
    provider,
    booking,
    address: parseAddress(record.address) ?? undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function parseOrdersPagination(raw: unknown, fallbackCount: number): OrdersPagination {
  const pagination = asRecord(raw) ?? {};
  const page = Math.max(1, toNumber(pagination.page, 1));
  const limit = Math.max(
    1,
    toNumber(pagination.limit, CUSTOMER_ORDERS_PAGE_LIMIT),
  );
  const totalDocs = Math.max(
    0,
    toNumber(
      pagination.totalDocs ?? pagination.total ?? fallbackCount,
      fallbackCount,
    ),
  );
  let totalPages = Math.max(1, toNumber(pagination.totalPages, 0));
  if (!pagination.totalPages) {
    totalPages = Math.max(1, Math.ceil(totalDocs / limit) || 1);
  }
  const hasNextPage =
    typeof pagination.hasNextPage === "boolean"
      ? pagination.hasNextPage
      : page < totalPages;
  const hasPrevPage =
    typeof pagination.hasPrevPage === "boolean"
      ? pagination.hasPrevPage
      : page > 1;
  return { page, limit, totalDocs, totalPages, hasNextPage, hasPrevPage };
}

/**
 * Live API envelope:
 * `{ success, message, data: Order[], pagination: { total, page, limit, totalPages } }`
 * Also accepts guide shape: `{ data: { orders, pagination } }`.
 */
function parseOrdersList(response: unknown): CustomerOrdersListResult {
  const root = asRecord(response) ?? {};
  const nested = asRecord(root.data);

  const rawOrders: unknown[] = Array.isArray(root.data)
    ? root.data
    : Array.isArray(nested?.orders)
      ? (nested.orders as unknown[])
      : Array.isArray(root.orders)
        ? (root.orders as unknown[])
        : Array.isArray(response)
          ? response
          : [];

  const orders = rawOrders
    .map(parseOrderListItem)
    .filter((item): item is CustomerOrderListItem => Boolean(item));

  const pagination = parseOrdersPagination(
    nested?.pagination ?? root.pagination,
    orders.length,
  );
  return { orders, pagination };
}

function parseOrderDetail(response: unknown): CustomerOrderDetail {
  const root = asRecord(response) ?? {};
  // Detail may be `{ data: order }` or the order object itself.
  const data =
    asRecord(root.data) ??
    (Array.isArray(root.data) ? asRecord(root.data[0]) : null) ??
    root;
  const pricing = asRecord(data.pricing) ?? {};
  const payment = asRecord(data.payment) ?? {};
  const rawChangeOrders = Array.isArray(data.changeOrders)
    ? data.changeOrders
    : [];
  const rawAudit = Array.isArray(data.lifecycleAudit)
    ? data.lifecycleAudit
    : [];

  const serviceIdRaw = data.serviceId;
  const serviceId =
    typeof serviceIdRaw === "string"
      ? serviceIdRaw
      : pickId(asRecord(serviceIdRaw) ?? {}) || undefined;

  const bookingIdRaw = data.bookingId;
  const bookingFromNested = parseBookingSummary(bookingIdRaw);
  const bookingId =
    typeof bookingIdRaw === "string"
      ? bookingIdRaw
      : bookingFromNested?.id;

  const providerIdRaw = data.providerId;
  const providerFromNested = parseProviderSummary(providerIdRaw);
  const providerId =
    typeof providerIdRaw === "string"
      ? providerIdRaw
      : providerFromNested?.id;

  const taxAmount =
    pricing.taxAmount ?? pricing.tax;

  return {
    id: pickId(data),
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : "",
    status:
      (typeof data.status === "string" && data.status) || "BOOKING_REQUESTED",
    bookingId,
    customerId:
      typeof data.customerId === "string" ? data.customerId : undefined,
    providerId,
    serviceId,
    pricing: {
      basePrice:
        pricing.basePrice == null ? undefined : toNumber(pricing.basePrice, 0),
      changeOrdersTotal:
        pricing.changeOrdersTotal == null
          ? undefined
          : toNumber(pricing.changeOrdersTotal, 0),
      subtotal:
        pricing.subtotal == null ? undefined : toNumber(pricing.subtotal, 0),
      taxRate:
        pricing.taxRate == null ? undefined : toNumber(pricing.taxRate, 0),
      taxAmount: taxAmount == null ? undefined : toNumber(taxAmount, 0),
      platformFee:
        pricing.platformFee == null
          ? undefined
          : toNumber(pricing.platformFee, 0),
      totalAmount: toNumber(pricing.totalAmount, 0),
      currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
    },
    payment: {
      status:
        (typeof payment.status === "string" && payment.status) ||
        (typeof pricing.paymentStatus === "string"
          ? pricing.paymentStatus
          : undefined),
      authorizationHoldId:
        (typeof payment.authorizationHoldId === "string" &&
          payment.authorizationHoldId) ||
        (typeof pricing.paymentHoldId === "string"
          ? pricing.paymentHoldId
          : undefined),
    },
    address: parseAddress(data.address),
    customerNotes:
      typeof data.customerNotes === "string"
        ? data.customerNotes
        : typeof asRecord(data.address)?.notes === "string"
          ? String(asRecord(data.address)?.notes)
          : undefined,
    service:
      parseServiceSummary(data.serviceSnapshot) ||
      parseServiceSummary(data.service),
    provider:
      parseProviderSummary(data.provider) || providerFromNested,
    booking:
      parseBookingSummary(data.booking) || bookingFromNested,
    changeOrders: rawChangeOrders
      .map(parseChangeOrder)
      .filter((item): item is ChangeOrderItem => Boolean(item)),
    lifecycleAudit: rawAudit
      .map(parseLifecycleEntry)
      .filter((item): item is LifecycleAuditEntry => Boolean(item)),
    completionDetails: parseCompletionDetails(data.completionDetails),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

function listRequestKey(arg: {
  page?: number;
  limit?: number;
  status?: string;
}): string {
  return JSON.stringify({
    page: Math.max(1, Number(arg.page) || 1),
    limit: Math.max(1, Number(arg.limit) || CUSTOMER_ORDERS_PAGE_LIMIT),
    status: String(arg.status || "").trim().toUpperCase() || null,
  });
}

function parseCheckout(response: unknown): OrderCheckoutResult {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? {};
  const order = asRecord(data.order) ?? data;
  const booking = asRecord(data.booking);
  const pricing = asRecord(order.pricing) ?? {};
  const payment = asRecord(order.payment) ?? {};

  const id =
    (typeof order.id === "string" && order.id) ||
    (typeof order._id === "string" && order._id) ||
    "";

  return {
    message:
      (typeof root.message === "string" && root.message.trim()) ||
      "Order placed and appointment slot reserved successfully",
    order: {
      id,
      orderNumber:
        typeof order.orderNumber === "string" ? order.orderNumber : "",
      bookingId:
        typeof order.bookingId === "string" ? order.bookingId : undefined,
      status: (typeof order.status === "string" && order.status) || "CONFIRMED",
      pricing: {
        basePrice: toNumber(pricing.basePrice, 0),
        changeOrdersTotal: toNumber(pricing.changeOrdersTotal, 0),
        subtotal: toNumber(pricing.subtotal, 0),
        taxRate: toNumber(pricing.taxRate, 0),
        taxAmount: toNumber(pricing.taxAmount, 0),
        platformFee: toNumber(pricing.platformFee, 0),
        totalAmount: toNumber(pricing.totalAmount, 0),
        currency:
          typeof pricing.currency === "string" ? pricing.currency : "USD",
      },
      payment: {
        status:
          typeof payment.status === "string" ? payment.status : undefined,
        authorizationHoldId:
          typeof payment.authorizationHoldId === "string"
            ? payment.authorizationHoldId
            : undefined,
      },
    },
    booking: booking
      ? {
          id:
            (typeof booking.id === "string" && booking.id) ||
            (typeof booking._id === "string" && booking._id) ||
            "",
          providerId:
            typeof booking.providerId === "string"
              ? booking.providerId
              : undefined,
          startTime:
            typeof booking.startTime === "string" ? booking.startTime : "",
          endTime: typeof booking.endTime === "string" ? booking.endTime : "",
          bufferEndTime:
            typeof booking.bufferEndTime === "string"
              ? booking.bufferEndTime
              : undefined,
          status:
            typeof booking.status === "string" ? booking.status : "CONFIRMED",
        }
      : undefined,
  };
}

export const fetchBookingAvailability = createAsyncThunk<
  SlotAvailabilityResponse,
  { serviceId: string; date: string; timezone?: string },
  { rejectValue: string }
>("orders/fetchAvailability", async (arg, { rejectWithValue }) => {
  const serviceId = String(arg.serviceId || "").trim();
  const date = String(arg.date || "").trim();
  if (!serviceId || !date) {
    return rejectWithValue("Service and date are required.");
  }
  try {
    const response = await getData(
      bookingsApi.availability,
      {
        serviceId,
        date,
        timezone: arg.timezone || undefined,
      },
      { silent: true },
    );
    return parseAvailability(response);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const checkoutFixedServiceOrder = createAsyncThunk<
  OrderCheckoutResult,
  OrderCheckoutRequest,
  { rejectValue: string }
>("orders/checkout", async (payload, { rejectWithValue }) => {
  try {
    const response = await postData(ordersApi.checkout, payload, {
      silent: true,
    });
    return parseCheckout(response);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchCustomerOrders = createAsyncThunk<
  CustomerOrdersListResult,
  { page?: number; limit?: number; status?: string } | undefined,
  {
    state: { orders: OrdersState };
    rejectValue: string;
  }
>(
  "orders/fetchCustomerOrders",
  async (arg, { rejectWithValue }) => {
    const page = Math.max(1, Number(arg?.page) || 1);
    const limit = Math.max(
      1,
      Number(arg?.limit) || CUSTOMER_ORDERS_PAGE_LIMIT,
    );
    const status = String(arg?.status || "").trim() || undefined;
    try {
      const response = await getData(
        ordersApi.list,
        {
          page,
          limit,
          status,
        },
        { silent: true },
      );
      return parseOrdersList(response);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const key = listRequestKey(arg || {});
      const state = getState().orders;
      if (state.listLoading && state.listRequestKey === key) return false;
      return true;
    },
  },
);

export const fetchCustomerOrderById = createAsyncThunk<
  CustomerOrderDetail,
  string,
  {
    state: { orders: OrdersState };
    rejectValue: string;
  }
>(
  "orders/fetchCustomerOrderById",
  async (id, { rejectWithValue }) => {
    const trimmed = String(id || "").trim();
    if (!trimmed) {
      return rejectWithValue("Order id is required.");
    }
    try {
      const response = await getData(ordersApi.byId(trimmed), undefined, {
        silent: true,
      });
      const detail = parseOrderDetail(response);
      if (!detail.id) {
        return rejectWithValue("Order not found.");
      }
      return detail;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (id, { getState }) => {
      const trimmed = String(id || "").trim();
      if (!trimmed) return false;
      const state = getState().orders;
      // Avoid duplicate in-flight GETs; allow refresh when preview is already shown.
      if (state.detailLoading) return false;
      return true;
    },
  },
);

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    clearAvailability(state) {
      state.availability = null;
      state.availabilityError = null;
      state.availabilityLoading = false;
    },
    clearCheckoutError(state) {
      state.checkoutError = null;
    },
    setPendingOrderDraft(state, action: PayloadAction<PendingFixedOrder>) {
      state.pendingDraft = action.payload;
    },
    clearPendingOrderDraft(state) {
      state.pendingDraft = null;
    },
    /** Stash list/card order so detail can render without waiting on GET. */
    setCustomerOrderDetail(state, action: PayloadAction<CustomerOrderDetail>) {
      state.detail = action.payload;
      state.detailLoading = false;
      state.detailError = null;
    },
    clearCustomerOrderDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
    },
    clearCustomerOrdersError(state) {
      state.listError = null;
      state.detailError = null;
    },
    resetOrders() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookingAvailability.pending, (state) => {
        state.availabilityLoading = true;
        state.availabilityError = null;
      })
      .addCase(fetchBookingAvailability.fulfilled, (state, action) => {
        state.availabilityLoading = false;
        state.availability = action.payload;
        state.availabilityError = null;
      })
      .addCase(fetchBookingAvailability.rejected, (state, action) => {
        state.availabilityLoading = false;
        state.availability = null;
        state.availabilityError =
          action.payload ||
          action.error.message ||
          "Failed to load available slots.";
      })
      .addCase(checkoutFixedServiceOrder.pending, (state) => {
        state.checkoutLoading = true;
        state.checkoutError = null;
      })
      .addCase(checkoutFixedServiceOrder.fulfilled, (state, action) => {
        state.checkoutLoading = false;
        state.lastCheckout = action.payload;
        state.checkoutError = null;
        state.pendingDraft = null;
      })
      .addCase(checkoutFixedServiceOrder.rejected, (state, action) => {
        state.checkoutLoading = false;
        state.checkoutError =
          action.payload ||
          action.error.message ||
          "Failed to place the order.";
      })
      .addCase(fetchCustomerOrders.pending, (state, action) => {
        state.listLoading = true;
        state.listError = null;
        state.listRequestKey = listRequestKey(action.meta.arg || {});
      })
      .addCase(fetchCustomerOrders.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload.orders;
        state.listPagination = action.payload.pagination;
        state.listLoaded = true;
        state.listError = null;
        state.listRequestKey = null;
      })
      .addCase(fetchCustomerOrders.rejected, (state, action) => {
        state.listLoading = false;
        state.listRequestKey = null;
        state.listError =
          action.payload ||
          action.error.message ||
          "Failed to load your orders.";
      })
      .addCase(fetchCustomerOrderById.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
      })
      .addCase(fetchCustomerOrderById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
        state.detailError = null;
      })
      .addCase(fetchCustomerOrderById.rejected, (state, action) => {
        state.detailLoading = false;
        // Keep stashed preview if we already have something to show.
        if (!state.detail) {
          state.detailError =
            action.payload ||
            action.error.message ||
            "Failed to load order details.";
        }
      });
  },
});

export const {
  clearAvailability,
  clearCheckoutError,
  setPendingOrderDraft,
  clearPendingOrderDraft,
  setCustomerOrderDetail,
  clearCustomerOrderDetail,
  clearCustomerOrdersError,
  resetOrders,
} = ordersSlice.actions;

/** Build a detail preview from a list card (same idea as setPublicFixedServiceDetail). */
export function customerOrderDetailFromListItem(
  item: CustomerOrderListItem,
): CustomerOrderDetail {
  return {
    id: item.id,
    orderNumber: item.orderNumber,
    status: item.status,
    pricing: {
      basePrice: item.pricing.basePrice,
      subtotal: item.pricing.subtotal,
      totalAmount: item.pricing.totalAmount,
      currency: item.pricing.currency,
    },
    address: item.address ?? null,
    service: item.service,
    provider: item.provider,
    booking: item.booking,
    changeOrders: [],
    lifecycleAudit: [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const selectCustomerOrders = (state: { orders?: OrdersState }) =>
  state.orders?.list ?? [];

export const selectCustomerOrdersPagination = (state: {
  orders?: OrdersState;
}) => state.orders?.listPagination ?? emptyPagination();

export const selectCustomerOrdersLoading = (state: { orders?: OrdersState }) =>
  Boolean(state.orders?.listLoading);

export const selectCustomerOrdersError = (state: { orders?: OrdersState }) =>
  state.orders?.listError ?? null;

export const selectCustomerOrderDetail = (state: { orders?: OrdersState }) =>
  state.orders?.detail ?? null;

export const selectCustomerOrderDetailLoading = (state: {
  orders?: OrdersState;
}) => Boolean(state.orders?.detailLoading);

export const selectCustomerOrderDetailError = (state: {
  orders?: OrdersState;
}) => state.orders?.detailError ?? null;

export default ordersSlice.reducer;
