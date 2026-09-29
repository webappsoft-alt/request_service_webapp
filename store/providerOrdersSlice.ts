import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData, postData, putData } from "@/components/api/sliceHttp";
import { providerOrdersApi } from "@/components/api/ApiRoutesFile";
import type {
  ArriveOrderPayload,
  CancelOrderPayload,
  CompleteOrderPayload,
  ProposeChangeOrderPayload,
  ProviderBookingSnapshot,
  ProviderOrder,
  ProviderOrdersListResponse,
  ProviderOrdersPagination,
  ProviderOrdersQueryParams,
  RejectOrderPayload,
  TransitOrderPayload,
} from "@/lib/types/provider-order";

export type ProviderOrdersState = {
  items: ProviderOrder[];
  /** Cached list rows keyed by `status|search|page|limit` for soft page switches. */
  pagesCache: Record<string, ProviderOrder[]>;
  /** Cached order details by id for soft detail revisits / inner tabs. */
  detailsCache: Record<string, ProviderOrder>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  pagination: ProviderOrdersPagination;
  statusFilter: string;
  loading: boolean;
  mutating: boolean;
  actionLoading: Record<string, boolean>;
  selectedOrder: ProviderOrder | null;
  selectedLoading: boolean;
  error: string | null;
};

export function providerOrdersPageCacheKey(
  status: string,
  search: string,
  page: number,
  limit: number,
) {
  return `${(status || "").trim()}|${(search || "").trim()}|${page}|${limit}`;
}

const emptyPagination = (): ProviderOrdersPagination => ({
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
});

const initialState: ProviderOrdersState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  search: "",
  pagination: emptyPagination(),
  statusFilter: "",
  loading: false,
  mutating: false,
  actionLoading: {},
  selectedOrder: null,
  selectedLoading: false,
  error: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickId(record: Record<string, unknown>): string {
  return (
    (typeof record.id === "string" && record.id) ||
    (typeof record._id === "string" && record._id) ||
    ""
  );
}

function resolveOrderPayload(response: unknown): Record<string, unknown> {
  const root = asRecord(response) ?? {};
  const data = asRecord(root.data) ?? root;
  const nested = asRecord(data.order);
  // Prefer nested full order when present, but keep sibling fields (e.g. changeOrders
  // living on the outer envelope in some payloads).
  if (
    nested &&
    (typeof nested.orderNumber === "string" ||
      typeof nested.status === "string" ||
      Array.isArray(nested.changeOrders) ||
      asRecord(nested.pricing) != null)
  ) {
    const outerCos = Array.isArray(data.changeOrders) ? data.changeOrders : null;
    const nestedCos = Array.isArray(nested.changeOrders)
      ? nested.changeOrders
      : null;
    return {
      ...data,
      ...nested,
      changeOrders: nestedCos ?? outerCos ?? [],
    };
  }
  return data;
}

function normalizeOrder(raw: unknown): ProviderOrder {
  const record = asRecord(raw) ?? {};
  const pricing = asRecord(record.pricing) ?? {};
  const payment = asRecord(record.payment) ?? {};
  const address = asRecord(record.address) ?? {};
  const loc = asRecord(address.location);
  const coords = Array.isArray(loc?.coordinates)
    ? (loc.coordinates as [number, number])
    : undefined;

  const service = asRecord(record.serviceSnapshot) ?? asRecord(record.service);
  const customer = asRecord(record.customerId) ?? asRecord(record.customer);
  const bookingRec = asRecord(record.bookingId) ?? asRecord(record.booking);
  const completionDetails = asRecord(record.completionDetails);

  const rawChangeOrders = Array.isArray(record.changeOrders)
    ? record.changeOrders
    : Array.isArray(record.change_orders)
      ? record.change_orders
      : [];

  const customerName =
    (typeof customer?.name === "string" && customer.name) ||
    `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() ||
    "Customer";

  const booking: ProviderBookingSnapshot | undefined = bookingRec
    ? {
        id: pickId(bookingRec),
        startTime:
          typeof bookingRec.startTime === "string"
            ? bookingRec.startTime
            : undefined,
        endTime:
          typeof bookingRec.endTime === "string"
            ? bookingRec.endTime
            : undefined,
        durationMinutes: toNumber(bookingRec.durationMinutes, 60),
      }
    : undefined;

  const street =
    (typeof address.street === "string" && address.street.trim()) ||
    (typeof address.address === "string" && address.address.trim()) ||
    "";

  return {
    id: pickId(record),
    orderNumber:
      typeof record.orderNumber === "string" ? record.orderNumber : "",
    bookingId:
      typeof record.bookingId === "string"
        ? record.bookingId
        : pickId(bookingRec ?? {}) || undefined,
    customerId:
      typeof record.customerId === "string"
        ? record.customerId
        : pickId(customer ?? {}) || undefined,
    providerId:
      typeof record.providerId === "string"
        ? record.providerId
        : pickId(asRecord(record.providerId) ?? {}) || undefined,
    serviceId:
      typeof record.serviceId === "string"
        ? record.serviceId
        : pickId(asRecord(record.serviceId) ?? {}) || undefined,
    status:
      (typeof record.status === "string" && record.status) ||
      "BOOKING_REQUESTED",
    pricing: {
      basePrice: toNumber(pricing.basePrice, 0),
      changeOrdersTotal: toNumber(pricing.changeOrdersTotal, 0),
      subtotal: toNumber(pricing.subtotal, 0),
      taxRate: toNumber(pricing.taxRate, 0),
      taxAmount: toNumber(pricing.taxAmount ?? pricing.tax, 0),
      platformFee: toNumber(pricing.platformFee, 0),
      totalAmount: toNumber(pricing.totalAmount, 0),
      currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
    },
    payment: {
      status:
        (typeof payment.status === "string" && payment.status) ||
        (typeof pricing.paymentStatus === "string" && pricing.paymentStatus) ||
        "HOLD_AUTHORIZED",
      authorizationHoldId:
        (typeof payment.authorizationHoldId === "string" &&
          payment.authorizationHoldId) ||
        (typeof pricing.paymentHoldId === "string" && pricing.paymentHoldId) ||
        undefined,
    },
    address: {
      street,
      unit: typeof address.unit === "string" ? address.unit : undefined,
      city: typeof address.city === "string" ? address.city : "",
      state: typeof address.state === "string" ? address.state : "",
      zip: typeof address.zip === "string" ? address.zip : "",
      notes: typeof address.notes === "string" ? address.notes : undefined,
      location: coords
        ? {
            type: "Point",
            coordinates: [toNumber(coords[0]), toNumber(coords[1])],
          }
        : undefined,
    },
    booking,
    service: service
      ? {
          id: pickId(service),
          title:
            (typeof service.servicesName === "string" &&
              service.servicesName) ||
            (typeof service.title === "string" && service.title) ||
            (typeof service.name === "string" && service.name) ||
            "Service",
          category:
            typeof service.categoryName === "string"
              ? service.categoryName
              : typeof service.category === "string"
                ? service.category
                : typeof asRecord(service.category)?.name === "string"
                  ? String(asRecord(service.category)?.name)
                  : undefined,
          subcategory:
            typeof service.subcategoryName === "string"
              ? service.subcategoryName
              : typeof service.subcategory === "string"
                ? service.subcategory
                : typeof asRecord(service.subcategory)?.name === "string"
                  ? String(asRecord(service.subcategory)?.name)
                  : undefined,
          images: Array.isArray(service.images)
            ? service.images.filter(
                (item): item is string => typeof item === "string",
              )
            : undefined,
          covered: Array.isArray(service.covered)
            ? service.covered.filter(
                (item): item is string => typeof item === "string",
              )
            : undefined,
          unit: typeof service.unit === "string" ? service.unit : undefined,
          basePrice:
            service.basePrice != null
              ? toNumber(service.basePrice, 0)
              : undefined,
        }
      : undefined,
    customer: customer
      ? {
          id: pickId(customer),
          name: customerName,
          firstName:
            typeof customer.firstName === "string"
              ? customer.firstName
              : undefined,
          lastName:
            typeof customer.lastName === "string"
              ? customer.lastName
              : undefined,
          phone:
            typeof customer.phone === "string" ? customer.phone : undefined,
          email:
            typeof customer.email === "string" ? customer.email : undefined,
          avatarUrl:
            (typeof customer.avatarUrl === "string" && customer.avatarUrl) ||
            (typeof customer.avatar === "string" && customer.avatar) ||
            undefined,
        }
      : undefined,
    changeOrders: rawChangeOrders.map((co) => {
      const coRec = asRecord(co) ?? {};
      const rawCreated = coRec.createdAt ?? coRec.requestedAt;
      const createdAt =
        typeof rawCreated === "string"
          ? rawCreated
          : rawCreated != null
            ? String(rawCreated)
            : undefined;
      const evidencePhotos = Array.isArray(coRec.evidencePhotos)
        ? coRec.evidencePhotos.filter(
            (p): p is string => typeof p === "string",
          )
        : Array.isArray(coRec.evidenceImages)
          ? coRec.evidenceImages.filter(
              (p): p is string => typeof p === "string",
            )
          : undefined;
      return {
        id: pickId(coRec),
        description:
          typeof coRec.description === "string" ? coRec.description : "",
        reason: typeof coRec.reason === "string" ? coRec.reason : undefined,
        additionalAmount: toNumber(coRec.additionalAmount, 0),
        evidencePhotos,
        status: typeof coRec.status === "string" ? coRec.status : "PENDING",
        createdAt,
        respondedAt:
          typeof coRec.respondedAt === "string"
            ? coRec.respondedAt
            : undefined,
      };
    }),
    completionDetails: completionDetails
      ? {
          notes:
            typeof completionDetails.notes === "string"
              ? completionDetails.notes
              : undefined,
          completionNotes:
            typeof completionDetails.completionNotes === "string"
              ? completionDetails.completionNotes
              : typeof completionDetails.notes === "string"
                ? completionDetails.notes
                : undefined,
          beforePhotos: Array.isArray(completionDetails.beforePhotos)
            ? completionDetails.beforePhotos.filter(
                (p): p is string => typeof p === "string",
              )
            : undefined,
          afterPhotos: Array.isArray(completionDetails.afterPhotos)
            ? completionDetails.afterPhotos.filter(
                (p): p is string => typeof p === "string",
              )
            : Array.isArray(completionDetails.proofOfWorkImages)
              ? completionDetails.proofOfWorkImages.filter(
                  (p): p is string => typeof p === "string",
                )
              : undefined,
          proofOfWorkImages: Array.isArray(completionDetails.proofOfWorkImages)
            ? completionDetails.proofOfWorkImages.filter(
                (p): p is string => typeof p === "string",
              )
            : undefined,
          customerSignOff: asRecord(completionDetails.customerSignOff)
            ? {
                confirmed: Boolean(
                  asRecord(completionDetails.customerSignOff)?.confirmed,
                ),
                signedAt:
                  typeof asRecord(completionDetails.customerSignOff)?.signedAt ===
                  "string"
                    ? (asRecord(completionDetails.customerSignOff)
                        ?.signedAt as string)
                    : null,
                signatureUrl:
                  typeof asRecord(completionDetails.customerSignOff)
                    ?.signatureUrl === "string"
                    ? (asRecord(completionDetails.customerSignOff)
                        ?.signatureUrl as string)
                    : null,
                rating:
                  asRecord(completionDetails.customerSignOff)?.rating != null
                    ? toNumber(
                        asRecord(completionDetails.customerSignOff)?.rating,
                      )
                    : null,
                review:
                  typeof asRecord(completionDetails.customerSignOff)?.review ===
                  "string"
                    ? (asRecord(completionDetails.customerSignOff)
                        ?.review as string)
                    : null,
                tip: toNumber(
                  asRecord(completionDetails.customerSignOff)?.tip,
                  0,
                ),
              }
            : undefined,
          completedAt:
            typeof completionDetails.completedAt === "string"
              ? completionDetails.completedAt
              : undefined,
        }
      : undefined,
    rejectionReason:
      typeof record.rejectionReason === "string"
        ? record.rejectionReason
        : undefined,
    cancellationReason:
      typeof record.cancellationReason === "string"
        ? record.cancellationReason
        : undefined,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString(),
  };
}

function parseOrdersResponse(response: unknown): ProviderOrdersListResponse {
  const root = asRecord(response) ?? {};
  const rawOrders = Array.isArray(root.data)
    ? (root.data as unknown[])
    : Array.isArray(asRecord(root.data)?.orders)
      ? (asRecord(root.data)?.orders as unknown[])
      : Array.isArray(root.orders)
        ? (root.orders as unknown[])
        : Array.isArray(response)
          ? (response as unknown[])
          : [];

  const paginationRec =
    asRecord(root.pagination) ??
    asRecord(asRecord(root.data)?.pagination) ??
    {};
  const total = toNumber(
    paginationRec.total ?? paginationRec.totalDocs,
    rawOrders.length,
  );
  const page = toNumber(paginationRec.page, 1);
  const limit = toNumber(paginationRec.limit, 10);
  const totalPages = toNumber(
    paginationRec.totalPages,
    Math.max(1, Math.ceil(total / Math.max(1, limit))),
  );

  return {
    orders: rawOrders.map(normalizeOrder),
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/** 1. Fetch provider assigned orders list with pagination and status */
export const fetchProviderOrders = createAsyncThunk<
  ProviderOrdersListResponse & {
    page: number;
    limit: number;
    search: string;
    status: string;
    cacheKey: string;
  },
  ProviderOrdersQueryParams | void,
  {
    state: { providerOrders: ProviderOrdersState };
    rejectValue: string;
  }
>(
  "providerOrders/fetchList",
  async (params, { getState, rejectWithValue }) => {
    const state = getState().providerOrders ?? initialState;
    const page = params?.page ?? state.page;
    const limit = params?.limit ?? state.limit;
    const search = params?.search ?? state.search;
    const status =
      params && "status" in params ? (params.status || "") : state.statusFilter;
    const force = Boolean(params?.force);
    const cacheKey = providerOrdersPageCacheKey(status, search, page, limit);

    // Soft cache hit (non-force): return cached rows without hitting the network.
    const cachedPage = state.pagesCache[cacheKey];
    if (!force && Array.isArray(cachedPage) && cachedPage.length > 0) {
      return {
        orders: cachedPage,
        pagination: {
          page,
          limit,
          total: state.total,
          totalPages: state.totalPages,
        },
        page,
        limit,
        search,
        status,
        cacheKey,
      };
    }

    try {
      const query: Record<string, string | number> = {
        page: Math.max(1, Number(page) || 1),
        limit: Math.max(1, Number(limit) || 10),
      };
      if (status && status !== "ALL") {
        query.status = status;
      }
      if (search && search.trim()) {
        query.search = search.trim();
      }
      const response = await getData(providerOrdersApi.list, query, {
        silent: true,
        force: true,
      });
      const parsed = parseOrdersResponse(response);
      return {
        ...parsed,
        page,
        limit,
        search,
        status,
        cacheKey,
      };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

/** 2. Fetch single provider order execution details */
export const fetchProviderOrderById = createAsyncThunk<
  ProviderOrder,
  string,
  {
    state: { providerOrders: ProviderOrdersState };
    rejectValue: string;
  }
>("providerOrders/fetchById", async (id, { rejectWithValue }) => {
  const trimmed = String(id || "").trim();
  if (!trimmed) return rejectWithValue("Order ID is required.");
  try {
    const response = await getData(providerOrdersApi.byId(trimmed), undefined, {
      silent: true,
      force: true,
    });
    const order = normalizeOrder(resolveOrderPayload(response));
    if (!order.id) {
      return rejectWithValue("Order not found.");
    }
    return order;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 3. Accept incoming booking request (BOOKING_REQUESTED -> CONFIRMED) */
export const acceptProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  string,
  { rejectValue: string }
>("providerOrders/accept", async (id, { rejectWithValue }) => {
  const trimmed = String(id || "").trim();
  try {
    const response = await putData(providerOrdersApi.accept(trimmed), undefined, {
      silent: true,
    });
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "CONFIRMED",
      message:
        typeof root.message === "string"
          ? root.message
          : "Booking request accepted and confirmed.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 4. Reject incoming booking request (BOOKING_REQUESTED -> CANCELLED) */
export const rejectProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  RejectOrderPayload,
  { rejectValue: string }
>("providerOrders/reject", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await putData(
      providerOrdersApi.reject(trimmed),
      {
        rejectionReason: payload.rejectionReason || payload.reason,
        reason: payload.reason,
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "CANCELLED",
      message:
        typeof root.message === "string"
          ? root.message
          : "Booking request declined and slot released.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 5. Depart for job location (CONFIRMED -> IN_TRANSIT) */
export const transitProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string; coords: [number, number] },
  TransitOrderPayload,
  { rejectValue: string }
>("providerOrders/transit", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await putData(
      providerOrdersApi.transit(trimmed),
      {
        startCoordinates: payload.startCoordinates,
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "IN_TRANSIT",
      coords: payload.startCoordinates,
      message:
        typeof root.message === "string"
          ? root.message
          : "Departed for job location. Status is now In Transit.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 6. Arrive on-site with Geofence verification (IN_TRANSIT -> ARRIVED) */
export const arriveProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string; coords: [number, number] },
  ArriveOrderPayload,
  { rejectValue: string }
>("providerOrders/arrive", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await putData(
      providerOrdersApi.arrive(trimmed),
      {
        coordinates: payload.coordinates,
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "ARRIVED",
      coords: payload.coordinates,
      message:
        typeof root.message === "string"
          ? root.message
          : "On-site arrival verified within geofence successfully.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 7. Start physical work (ARRIVED -> IN_PROGRESS) */
export const startWorkProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  string,
  { rejectValue: string }
>("providerOrders/startWork", async (id, { rejectWithValue }) => {
  const trimmed = String(id || "").trim();
  try {
    const response = await putData(providerOrdersApi.startWork(trimmed), undefined, {
      silent: true,
    });
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "IN_PROGRESS",
      message:
        typeof root.message === "string"
          ? root.message
          : "Physical service work started.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 8. Propose in-app change order (IN_PROGRESS -> CHANGE_ORDER_PENDING) */
export const proposeChangeOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  ProposeChangeOrderPayload,
  { rejectValue: string }
>("providerOrders/changeOrder", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await postData(
      providerOrdersApi.changeOrder(trimmed),
      {
        description: payload.description,
        reason: payload.reason,
        additionalAmount: payload.additionalAmount,
        evidencePhotos: payload.evidencePhotos || [],
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "CHANGE_ORDER_PENDING",
      message:
        typeof root.message === "string"
          ? root.message
          : "Change order proposed and customer notified.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 9. Submit work completion with evidence (IN_PROGRESS -> WORK_COMPLETED) */
export const completeProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  CompleteOrderPayload,
  { rejectValue: string }
>("providerOrders/complete", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await putData(
      providerOrdersApi.complete(trimmed),
      {
        completionNotes: payload.completionNotes,
        beforePhotos: payload.beforePhotos || [],
        afterPhotos: payload.afterPhotos,
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "WORK_COMPLETED",
      message:
        typeof root.message === "string"
          ? root.message
          : "Work completed successfully and submitted for sign-off.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** 10. Provider emergency cancellation (CONFIRMED/IN_TRANSIT -> CANCELLED) */
export const cancelProviderOrder = createAsyncThunk<
  { id: string; status: string; message: string },
  CancelOrderPayload,
  { rejectValue: string }
>("providerOrders/cancel", async (payload, { rejectWithValue }) => {
  const trimmed = String(payload.id || "").trim();
  try {
    const response = await putData(
      providerOrdersApi.cancel(trimmed),
      {
        reason: payload.reason,
      },
      { silent: true },
    );
    const root = asRecord(response) ?? {};
    return {
      id: trimmed,
      status: "CANCELLED",
      message:
        typeof root.message === "string"
          ? root.message
          : "Order cancelled and booking slot released.",
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const providerOrdersSlice = createSlice({
  name: "providerOrders",
  initialState,
  reducers: {
    setProviderOrdersSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagination.page = 1;
      state.pagesCache = {};
    },
    setProviderOrdersPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      state.pagination.page = state.page;
      const key = providerOrdersPageCacheKey(
        state.statusFilter,
        state.search,
        state.page,
        state.limit,
      );
      const cached = state.pagesCache[key];
      if (cached) {
        state.items = cached;
      }
    },
    setProviderOrdersStatus(state, action: PayloadAction<string>) {
      state.statusFilter = action.payload || "";
      state.page = 1;
      state.pagination.page = 1;
      const key = providerOrdersPageCacheKey(
        state.statusFilter,
        state.search,
        1,
        state.limit,
      );
      const cached = state.pagesCache[key];
      if (cached) {
        state.items = cached;
      }
    },
    setStatusFilter(state, action: PayloadAction<string | null>) {
      state.statusFilter = action.payload || "";
      state.page = 1;
      state.pagination.page = 1;
      const key = providerOrdersPageCacheKey(
        state.statusFilter,
        state.search,
        1,
        state.limit,
      );
      const cached = state.pagesCache[key];
      if (cached) {
        state.items = cached;
      }
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      state.pagination.page = state.page;
      const key = providerOrdersPageCacheKey(
        state.statusFilter,
        state.search,
        state.page,
        state.limit,
      );
      const cached = state.pagesCache[key];
      if (cached) {
        state.items = cached;
      }
    },
    setSelectedOrder(state, action: PayloadAction<ProviderOrder | null>) {
      state.selectedOrder = action.payload;
    },
    clearProviderOrdersError(state) {
      state.error = null;
    },
    resetProviderOrders() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // 1. Fetch List — soft pending: keep rows when cache has data (Leads pattern)
    builder
      .addCase(fetchProviderOrders.pending, (state, action) => {
        state.error = null;
        const targetPage = action.meta.arg?.page ?? state.page;
        const targetLimit = action.meta.arg?.limit ?? state.limit;
        const targetStatus =
          action.meta.arg && "status" in action.meta.arg
            ? action.meta.arg.status || ""
            : state.statusFilter;
        const targetSearch =
          action.meta.arg && "search" in action.meta.arg
            ? action.meta.arg.search || ""
            : state.search;
        const key = providerOrdersPageCacheKey(
          targetStatus,
          targetSearch,
          targetPage,
          targetLimit,
        );
        const cached = state.pagesCache[key];
        if (Array.isArray(cached) && cached.length > 0) {
          state.items = cached;
          state.loading = false;
        } else {
          state.loading = true;
        }
      })
      .addCase(fetchProviderOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.orders;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.total = action.payload.pagination.total;
        state.totalPages = Math.max(1, action.payload.pagination.totalPages);
        state.pagination = action.payload.pagination;
        state.search = action.payload.search;
        state.statusFilter = action.payload.status;
        state.error = null;
        if (state.page > state.totalPages) {
          state.page = state.totalPages;
          state.pagination.page = state.totalPages;
        }
        const key =
          action.payload.cacheKey ||
          providerOrdersPageCacheKey(
            state.statusFilter,
            state.search,
            state.page,
            state.limit,
          );
        state.pagesCache[key] = action.payload.orders;
        for (const order of action.payload.orders) {
          if (order?.id) state.detailsCache[order.id] = order;
        }
      })
      .addCase(fetchProviderOrders.rejected, (state, action) => {
        state.loading = false;
        if (action.meta.condition) {
          return;
        }
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load provider orders.";
      });

    // 2. Fetch By Id — soft pending when this order is already on screen / cached
    builder
      .addCase(fetchProviderOrderById.pending, (state, action) => {
        state.error = null;
        const id = action.meta.arg;
        const cached = state.detailsCache[id];
        if (cached) {
          state.selectedOrder = cached;
          state.selectedLoading = false;
        } else if (state.selectedOrder?.id === id) {
          state.selectedLoading = false;
        } else {
          if (state.selectedOrder && state.selectedOrder.id !== id) {
            state.selectedOrder = null;
          }
          state.selectedLoading = true;
        }
      })
      .addCase(fetchProviderOrderById.fulfilled, (state, action) => {
        state.selectedLoading = false;
        state.selectedOrder = action.payload;
        state.detailsCache[action.payload.id] = action.payload;
        // Also update in list if present
        const idx = state.items.findIndex((o) => o.id === action.payload.id);
        if (idx !== -1) {
          state.items[idx] = action.payload;
        }
        for (const k of Object.keys(state.pagesCache)) {
          state.pagesCache[k] = state.pagesCache[k].map((row) =>
            row.id === action.payload.id ? action.payload : row,
          );
        }
      })
      .addCase(fetchProviderOrderById.rejected, (state, action) => {
        state.selectedLoading = false;
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to load order details.";
      });

    // Helper for optimistic status transitions
    const handleActionPending = (
      state: ProviderOrdersState,
      orderId: string,
    ) => {
      state.mutating = true;
      state.actionLoading[orderId] = true;
      state.error = null;
    };

    const handleActionFulfilled = (
      state: ProviderOrdersState,
      orderId: string,
      nextStatus: string,
    ) => {
      state.mutating = false;
      delete state.actionLoading[orderId];
      // Invalidate pages cache on state mutation so fresh data is fetched
      state.pagesCache = {};
      // Update item in list
      const item = state.items.find((o) => o.id === orderId);
      if (item) {
        item.status = nextStatus;
      }
      // Update selectedOrder if it's currently open
      if (state.selectedOrder && state.selectedOrder.id === orderId) {
        state.selectedOrder.status = nextStatus;
      }
      const cached = state.detailsCache[orderId];
      if (cached) {
        cached.status = nextStatus;
      }
    };

    const handleActionRejected = (
      state: ProviderOrdersState,
      orderId: string,
      errorMsg?: string,
    ) => {
      state.mutating = false;
      delete state.actionLoading[orderId];
      state.error = errorMsg || "Order action failed.";
    };

    // 3. Accept
    builder
      .addCase(acceptProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg);
      })
      .addCase(acceptProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(acceptProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg, action.payload);
      });

    // 4. Reject
    builder
      .addCase(rejectProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(rejectProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(rejectProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });

    // 5. Transit
    builder
      .addCase(transitProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(transitProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(transitProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });

    // 6. Arrive
    builder
      .addCase(arriveProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(arriveProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(arriveProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });

    // 7. Start Work
    builder
      .addCase(startWorkProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg);
      })
      .addCase(startWorkProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(startWorkProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg, action.payload);
      });

    // 8. Change Order
    builder
      .addCase(proposeChangeOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(proposeChangeOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(proposeChangeOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });

    // 9. Complete Work
    builder
      .addCase(completeProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(completeProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(completeProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });

    // 10. Cancel Order
    builder
      .addCase(cancelProviderOrder.pending, (state, action) => {
        handleActionPending(state, action.meta.arg.id);
      })
      .addCase(cancelProviderOrder.fulfilled, (state, action) => {
        handleActionFulfilled(state, action.payload.id, action.payload.status);
      })
      .addCase(cancelProviderOrder.rejected, (state, action) => {
        handleActionRejected(state, action.meta.arg.id, action.payload);
      });
  },
});

export const {
  setProviderOrdersSearch,
  setProviderOrdersPage,
  setProviderOrdersStatus,
  setStatusFilter,
  setPage,
  setSelectedOrder,
  clearProviderOrdersError,
  resetProviderOrders,
} = providerOrdersSlice.actions;

export const selectProviderOrdersState = (state: {
  providerOrders: ProviderOrdersState;
}) => state.providerOrders;
export const selectProviderOrders = (state: {
  providerOrders: ProviderOrdersState;
}) => state.providerOrders.items;
export const selectProviderOrdersLoading = (state: {
  providerOrders: ProviderOrdersState;
}) => state.providerOrders.loading;
export const selectProviderOrdersMutating = (state: {
  providerOrders: ProviderOrdersState;
}) => state.providerOrders.mutating;

/** Full-page loader only when there is nothing cached to show. */
export const selectProviderOrdersShowLoader = (state: {
  providerOrders?: ProviderOrdersState;
}) => {
  const slice = state.providerOrders;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default providerOrdersSlice.reducer;
