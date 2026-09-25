import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  getPayment,
  queryPayments,
  updatePaymentArchive,
} from "@/lib/api/crm-client";
import type { Payment } from "@/lib/types";

export const PAYMENTS_DEFAULT_LIMIT = 20;

export type PaymentsState = {
  items: Payment[];
  pagesCache: Record<string, Payment[]>;
  detailsCache: Record<string, Payment>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  isArchived: boolean;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
};

export function paymentsCacheKey(
  search = "",
  status = "",
  isArchived = false,
  page = 1,
  limit = PAYMENTS_DEFAULT_LIMIT,
) {
  return `${isArchived ? "archived" : "active"}|${status.trim()}|${search.trim()}|${page}|${limit}`;
}

const initialState: PaymentsState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  page: 1,
  limit: PAYMENTS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  isArchived: false,
  loading: false,
  mutating: false,
  error: null,
  detailLoading: false,
  detailError: null,
};

function applyPaymentToState(state: PaymentsState, payment: Payment) {
  state.detailsCache[payment.id] = payment;
  const idx = state.items.findIndex((x) => x.id === payment.id);
  if (idx >= 0) state.items[idx] = payment;
  for (const k of Object.keys(state.pagesCache)) {
    state.pagesCache[k] = state.pagesCache[k].map((item) =>
      item.id === payment.id ? payment : item,
    );
  }
}

export const fetchPayments = createAsyncThunk<
  {
    items: Payment[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    isArchived: boolean;
    cacheKey: string;
  },
  {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    isArchived?: boolean;
    force?: boolean;
    silent?: boolean;
  } | void,
  { state: { payments: PaymentsState }; rejectValue: string }
>("payments/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().payments ?? initialState;
  const hasParams = params !== undefined && params !== null;
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const targetStatus =
    hasParams && "status" in params ? (params.status || "") : state.status;
  const targetSearch =
    hasParams && "search" in params ? (params.search || "") : state.search;
  const targetArchived =
    hasParams && "isArchived" in params
      ? Boolean(params.isArchived)
      : state.isArchived;
  const key = paymentsCacheKey(
    targetSearch,
    targetStatus,
    targetArchived,
    targetPage,
    targetLimit,
  );

  const force = params?.force ?? false;
  if (!force && key in state.pagesCache) {
    return {
      items: state.pagesCache[key],
      page: targetPage,
      total: state.total,
      totalPages: state.totalPages,
      search: targetSearch,
      status: targetStatus,
      isArchived: targetArchived,
      cacheKey: key,
    };
  }

  try {
    const result = await queryPayments({
      page: targetPage,
      limit: targetLimit,
      search: targetSearch.trim() || undefined,
      status: targetStatus.trim() || undefined,
      isArchived: targetArchived,
      force: true,
      silent: params?.silent ?? true,
    });
    return {
      items: result.items,
      page: result.page ?? targetPage,
      total: result.total,
      totalPages: result.totalPages,
      search: targetSearch,
      status: targetStatus,
      isArchived: targetArchived,
      cacheKey: key,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchPaymentDetail = createAsyncThunk<
  Payment,
  string,
  { rejectValue: string }
>("payments/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const payment = await getPayment(id);
    if (!payment) return rejectWithValue("Payment not found.");
    return payment;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchPaymentArchive = createAsyncThunk<
  Payment,
  { id: string; isArchived: boolean },
  { rejectValue: string }
>("payments/patchArchive", async ({ id, isArchived }, { rejectWithValue }) => {
  try {
    const updated = await updatePaymentArchive(id, isArchived);
    if (!updated) {
      return rejectWithValue("Payment archive was updated but could not be read.");
    }
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const paymentsSlice = createSlice({
  name: "payments",
  initialState,
  reducers: {
    setPaymentsSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setPaymentsPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = paymentsCacheKey(
        state.search,
        state.status,
        state.isArchived,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setPaymentsStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setPaymentsArchived(state, action: PayloadAction<boolean>) {
      state.isArchived = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setPaymentsListFilter(state, action: PayloadAction<string>) {
      const filter = action.payload;
      state.page = 1;
      state.pagesCache = {};
      state.items = [];
      state.total = 0;
      state.totalPages = 1;
      if (filter === "archived") {
        state.isArchived = true;
        state.status = "";
        return;
      }
      state.isArchived = false;
      state.status = filter === "" ? "" : filter;
    },
    invalidatePaymentsCache(state) {
      state.pagesCache = {};
    },
    clearPaymentsError(state) {
      state.error = null;
    },
    upsertPaymentItem(state, action: PayloadAction<Payment>) {
      state.pagesCache = {};
      state.detailsCache[action.payload.id] = action.payload;
      const matchesArchive =
        Boolean(action.payload.isArchived) === state.isArchived;
      const matchesStatus =
        !state.status || action.payload.status === state.status;
      if (matchesArchive && matchesStatus) {
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total = Math.max(state.total, state.items.length);
      } else {
        state.items = state.items.filter((item) => item.id !== action.payload.id);
      }
    },
    removePaymentItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      delete state.detailsCache[action.payload];
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayments.pending, (state, action) => {
        const p = action.meta.arg;
        const hasParams = p !== undefined && p !== null;
        const targetSearch =
          hasParams && "search" in p ? (p.search || "") : state.search;
        const targetStatus =
          hasParams && "status" in p ? (p.status || "") : state.status;
        const targetArchived =
          hasParams && "isArchived" in p
            ? Boolean(p.isArchived)
            : state.isArchived;
        const targetPage = hasParams && "page" in p ? (p.page ?? state.page) : state.page;
        const targetLimit =
          hasParams && "limit" in p ? (p.limit ?? state.limit) : state.limit;
        const key = paymentsCacheKey(
          targetSearch,
          targetStatus,
          targetArchived,
          targetPage,
          targetLimit,
        );
        if (key in state.pagesCache && state.pagesCache[key].length > 0) {
          state.items = state.pagesCache[key];
          state.loading = false;
        } else {
          state.items = state.pagesCache[key] ?? [];
          state.loading = state.items.length === 0;
        }
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.total = action.payload.total;
        state.totalPages = action.payload.totalPages;
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.isArchived = action.payload.isArchived;
        state.pagesCache[action.payload.cacheKey] = action.payload.items;
        for (const item of action.payload.items) {
          state.detailsCache[item.id] = item;
        }
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Could not load payments.";
      })
      .addCase(fetchPaymentDetail.pending, (state, action) => {
        const id = action.meta.arg;
        state.detailError = null;
        state.detailLoading = !state.detailsCache[id];
      })
      .addCase(fetchPaymentDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        applyPaymentToState(state, action.payload);
      })
      .addCase(fetchPaymentDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Could not load payment.";
      })
      .addCase(patchPaymentArchive.pending, (state) => {
        state.mutating = true;
      })
      .addCase(patchPaymentArchive.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyPaymentToState(state, action.payload);
        // Drop from current board if archive flag no longer matches filter
        if (Boolean(action.payload.isArchived) !== state.isArchived) {
          state.items = state.items.filter((item) => item.id !== action.payload.id);
          state.total = Math.max(0, state.total - 1);
        }
      })
      .addCase(patchPaymentArchive.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Could not update payment archive.";
      });
  },
});

export const {
  setPaymentsSearch,
  setPaymentsPage,
  setPaymentsStatus,
  setPaymentsArchived,
  setPaymentsListFilter,
  invalidatePaymentsCache,
  clearPaymentsError,
  upsertPaymentItem,
  removePaymentItemLocal,
} = paymentsSlice.actions;

export const selectPaymentsShowLoader = (state: {
  payments?: PaymentsState;
}) => {
  const slice = state.payments;
  if (!slice) return true;
  return slice.loading && slice.items.length === 0;
};

export default paymentsSlice.reducer;
