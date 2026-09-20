import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createInvoice,
  deleteInvoice,
  getInvoiceWithPayments,
  queryInvoices,
  recordInvoicePayment,
  sendInvoice,
  updateInvoice,
  updateInvoiceArchive,
} from "@/lib/api/crm-client";
import type { Invoice, InvoiceStatus, Payment } from "@/lib/types";

/** Default page size for GET /api/provider/invoices */
export const INVOICES_DEFAULT_LIMIT = 20;

/** Board / API status filter — empty means all active (non-archived). */
export type InvoiceListStatus =
  | ""
  | "unpaid"
  | "paid"
  | "overdue"
  | "draft"
  | "partially_paid"
  | "cancelled"
  | "archived";

export type InvoicesState = {
  items: Invoice[];
  /** Cached list rows keyed by `archived|status|search|page|limit` */
  pagesCache: Record<string, Invoice[]>;
  detailsCache: Record<string, Invoice>;
  /** Payments for an invoice detail, keyed by invoice id */
  detailPayments: Record<string, Payment[]>;
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

export function invoicesCacheKey(
  search = "",
  status = "",
  isArchived = false,
  page = 1,
  limit = INVOICES_DEFAULT_LIMIT,
) {
  return `${isArchived ? "archived" : "active"}|${status.trim()}|${search.trim()}|${page}|${limit}`;
}

const initialState: InvoicesState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  detailPayments: {},
  page: 1,
  limit: INVOICES_DEFAULT_LIMIT,
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

function applyInvoiceToState(state: InvoicesState, invoice: Invoice) {
  state.detailsCache[invoice.id] = invoice;
  const idx = state.items.findIndex((x) => x.id === invoice.id);
  if (idx >= 0) state.items[idx] = invoice;
  for (const k of Object.keys(state.pagesCache)) {
    state.pagesCache[k] = state.pagesCache[k].map((item) =>
      item.id === invoice.id ? invoice : item,
    );
  }
}

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchInvoices = createAsyncThunk<
  {
    items: Invoice[];
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
  { state: { invoices: InvoicesState }; rejectValue: string }
>("invoices/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().invoices ?? initialState;
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
  const key = invoicesCacheKey(
    targetSearch,
    targetStatus,
    targetArchived,
    targetPage,
    targetLimit,
  );

  try {
    const result = await queryInvoices({
      page: targetPage,
      limit: targetLimit,
      search: targetSearch.trim() || undefined,
      status: targetStatus.trim() || undefined,
      isArchived: targetArchived,
      force: params?.force ?? true,
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

export const fetchInvoiceDetail = createAsyncThunk<
  { invoice: Invoice; payments: Payment[] },
  string,
  { state: { invoices: InvoicesState }; rejectValue: string }
>("invoices/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const result = await getInvoiceWithPayments(id);
    if (!result.invoice) return rejectWithValue("Invoice not found.");
    return { invoice: result.invoice, payments: result.payments };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createInvoiceRecord = createAsyncThunk<
  Invoice,
  Invoice,
  { rejectValue: string }
>("invoices/create", async (invoice, { rejectWithValue }) => {
  try {
    const created = await createInvoice(invoice);
    if (!created) return rejectWithValue("Invoice was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateInvoiceRecord = createAsyncThunk<
  Invoice,
  { id: string; invoice: Invoice },
  { rejectValue: string }
>("invoices/update", async ({ id, invoice }, { rejectWithValue }) => {
  try {
    const updated = await updateInvoice(id, invoice);
    if (!updated) return rejectWithValue("Invoice was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/**
 * POST /invoices/:id/send → `{ success, data: { message, invoice } }`.
 * Map invoice when present; otherwise refetch detail.
 */
export const sendInvoiceRecord = createAsyncThunk<
  { invoice: Invoice; payments?: Payment[] },
  string,
  { rejectValue: string }
>("invoices/send", async (id, { rejectWithValue }) => {
  try {
    const mapped = await sendInvoice(id);
    if (mapped) return { invoice: mapped };

    const detail = await getInvoiceWithPayments(id);
    if (!detail.invoice) {
      return rejectWithValue("Invoice was sent but could not be read.");
    }
    return { invoice: detail.invoice, payments: detail.payments };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const recordInvoicePaymentRecord = createAsyncThunk<
  { payment: Payment | null; invoice: Invoice | null; invoiceId: string },
  { invoiceId: string; payment: Payment },
  { rejectValue: string }
>("invoices/recordPayment", async ({ invoiceId, payment }, { rejectWithValue }) => {
  try {
    const result = await recordInvoicePayment(invoiceId, payment);
    return {
      payment: result.payment,
      invoice: result.invoice,
      invoiceId,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteInvoiceRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("invoices/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteInvoice(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchInvoiceStatus = createAsyncThunk<
  Invoice,
  { id: string; status: InvoiceStatus },
  { state: { invoices: InvoicesState }; rejectValue: string }
>("invoices/patchStatus", async ({ id, status }, { getState, rejectWithValue }) => {
  try {
    const state = getState().invoices ?? initialState;
    const current =
      state.detailsCache[id] ?? state.items.find((item) => item.id === id);
    if (!current) {
      return rejectWithValue("Invoice not found. Refresh and try again.");
    }
    const updated = await updateInvoice(id, { ...current, status });
    if (!updated) {
      return rejectWithValue("Invoice status was updated but could not be read.");
    }
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchInvoiceArchive = createAsyncThunk<
  Invoice,
  { id: string; isArchived: boolean },
  { rejectValue: string }
>("invoices/patchArchive", async ({ id, isArchived }, { rejectWithValue }) => {
  try {
    const updated = await updateInvoiceArchive(id, isArchived);
    if (!updated) {
      return rejectWithValue("Invoice archive was updated but could not be read.");
    }
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const invoicesSlice = createSlice({
  name: "invoices",
  initialState,
  reducers: {
    setInvoicesSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setInvoicesPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = invoicesCacheKey(
        state.search,
        state.status,
        state.isArchived,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setInvoicesStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setInvoicesArchived(state, action: PayloadAction<boolean>) {
      state.isArchived = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    /** Apply board filter from URL: all | unpaid | … | archived */
    setInvoicesListFilter(state, action: PayloadAction<InvoiceListStatus>) {
      const filter = action.payload;
      state.page = 1;
      state.pagesCache = {};
      if (filter === "archived") {
        state.isArchived = true;
        state.status = "";
        return;
      }
      state.isArchived = false;
      state.status = filter === "" ? "" : filter;
    },
    invalidateInvoicesCache(state) {
      state.pagesCache = {};
    },
    clearInvoicesError(state) {
      state.error = null;
    },
    upsertInvoiceItem(state, action: PayloadAction<Invoice>) {
      state.pagesCache = {};
      state.detailsCache[action.payload.id] = action.payload;
      state.items = [
        action.payload,
        ...state.items.filter((item) => item.id !== action.payload.id),
      ];
      state.total = Math.max(state.total, state.items.length);
    },
    removeInvoiceItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      delete state.detailsCache[action.payload];
      delete state.detailPayments[action.payload];
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchInvoices ──
      .addCase(fetchInvoices.pending, (state, action) => {
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
        const targetPage = p?.page ?? state.page;
        const targetLimit = p?.limit ?? state.limit;
        const key = invoicesCacheKey(
          targetSearch,
          targetStatus,
          targetArchived,
          targetPage,
          targetLimit,
        );

        state.search = targetSearch;
        state.status = targetStatus;
        state.isArchived = targetArchived;
        state.page = targetPage;
        state.limit = targetLimit;
        state.error = null;

        if (key in state.pagesCache && state.pagesCache[key].length > 0) {
          state.items = state.pagesCache[key];
          state.loading = false;
        } else {
          state.items = state.pagesCache[key] ?? [];
          state.loading = true;
        }
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.isArchived = action.payload.isArchived;
        for (const item of action.payload.items) {
          state.detailsCache[item.id] = item;
        }
        state.pagesCache[action.payload.cacheKey] = action.payload.items;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load invoices.";
      })

      // ── fetchInvoiceDetail ──
      .addCase(fetchInvoiceDetail.pending, (state, action) => {
        state.detailError = null;
        const id = action.meta.arg;
        if (!state.detailsCache[id]) {
          state.detailLoading = true;
        }
      })
      .addCase(fetchInvoiceDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        const { invoice, payments } = action.payload;
        applyInvoiceToState(state, invoice);
        state.detailPayments[invoice.id] = payments;
      })
      .addCase(fetchInvoiceDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload ?? "Failed to fetch invoice details.";
      })

      // ── createInvoiceRecord ──
      .addCase(createInvoiceRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createInvoiceRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.detailsCache[action.payload.id] = action.payload;
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createInvoiceRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to create invoice.";
      })

      // ── updateInvoiceRecord ──
      .addCase(updateInvoiceRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateInvoiceRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyInvoiceToState(state, action.payload);
      })
      .addCase(updateInvoiceRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update invoice.";
      })

      // ── sendInvoiceRecord ──
      .addCase(sendInvoiceRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(sendInvoiceRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyInvoiceToState(state, action.payload.invoice);
        if (action.payload.payments) {
          state.detailPayments[action.payload.invoice.id] = action.payload.payments;
        }
      })
      .addCase(sendInvoiceRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to send invoice.";
      })

      // ── recordInvoicePaymentRecord ──
      .addCase(recordInvoicePaymentRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(recordInvoicePaymentRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        const { invoiceId, invoice, payment } = action.payload;
        if (invoice) {
          applyInvoiceToState(state, invoice);
        }
        if (payment) {
          const existing = state.detailPayments[invoiceId] ?? [];
          state.detailPayments[invoiceId] = [
            payment,
            ...existing.filter((p) => p.id !== payment.id),
          ];
        }
      })
      .addCase(recordInvoicePaymentRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to record payment.";
      })

      // ── patchInvoiceStatus ──
      .addCase(patchInvoiceStatus.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(patchInvoiceStatus.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        applyInvoiceToState(state, action.payload);
      })
      .addCase(patchInvoiceStatus.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update invoice status.";
      })

      // ── patchInvoiceArchive ──
      .addCase(patchInvoiceArchive.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(patchInvoiceArchive.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        const updated = action.payload;
        applyInvoiceToState(state, updated);
        const matchesArchive = Boolean(updated.isArchived) === state.isArchived;
        if (!matchesArchive) {
          state.items = state.items.filter((item) => item.id !== updated.id);
          state.total = Math.max(0, state.total - 1);
        }
      })
      .addCase(patchInvoiceArchive.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to update invoice archive.";
      })

      // ── deleteInvoiceRecord ──
      .addCase(deleteInvoiceRecord.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(deleteInvoiceRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        delete state.detailsCache[action.payload];
        delete state.detailPayments[action.payload];
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(deleteInvoiceRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload ?? "Failed to delete invoice.";
      });
  },
});

export const {
  setInvoicesSearch,
  setInvoicesPage,
  setInvoicesStatus,
  setInvoicesArchived,
  setInvoicesListFilter,
  invalidateInvoicesCache,
  clearInvoicesError,
  upsertInvoiceItem,
  removeInvoiceItemLocal,
} = invoicesSlice.actions;

export default invoicesSlice.reducer;
