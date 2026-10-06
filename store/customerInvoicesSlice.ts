import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData, postData } from "@/components/api/sliceHttp";
import { userApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";
import type { Payment } from "@/lib/types";

export type CustomerInvoiceItem = {
  id?: string;
  description: string;
  kind: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
};

export type CustomerInvoicePayment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  dueAt?: string | null;
  createdAt?: string | null;
  notes?: string;
  transactionReference?: string;
  proofUrl?: string;
};

export type CustomerInvoice = {
  id: string;
  number: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string;
  jobId: string | null;
  jobNumber: string | null;
  /** "change_order" = separate invoice for one job change order. */
  invoiceType?: "standard" | "change_order";
  changeOrderId?: string | null;
  changeOrderNumber?: string;
  changeOrderTitle?: string;
  items: CustomerInvoiceItem[];
  payments?: CustomerInvoicePayment[];
  createdAt?: string;
  updatedAt?: string;
  provider?: {
    id?: string;
    companyName?: string;
    slug?: string;
    phone?: string;
    email?: string;
  } | null;
};

export const CUSTOMER_INVOICES_PAGE_LIMIT = 10;

export type CustomerInvoicesPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CustomerInvoicesQuery = { page?: number; limit?: number; search?: string };

/** Identifies which page/search the rows in `items` belong to. */
export function customerInvoicesKey(arg?: CustomerInvoicesQuery | void) {
  if (!arg || arg.page == null) return "all";
  return JSON.stringify({
    page: Math.max(1, Number(arg.page) || 1),
    limit: Number(arg.limit) || CUSTOMER_INVOICES_PAGE_LIMIT,
    search: String(arg.search || "").trim(),
  });
}

type CustomerInvoicesState = {
  items: CustomerInvoice[];
  loading: boolean;
  loaded: boolean;
  /** Any list request in flight (incl. silent background refreshes). */
  fetching: boolean;
  loadedKey: string | null;
  pagination: CustomerInvoicesPagination | null;
  error: string | null;
  detail: CustomerInvoice | null;
  detailLoading: boolean;
  detailError: string | null;
};

const initialState: CustomerInvoicesState = {
  items: [],
  loading: false,
  loaded: false,
  fetching: false,
  loadedKey: null,
  pagination: null,
  error: null,
  detail: null,
  detailLoading: false,
  detailError: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function mapInvoice(raw: unknown): CustomerInvoice | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = stringValue(row.id);
  if (!id) return null;
  const provider = asRecord(row.provider);
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  return {
    id,
    number: stringValue(row.number) || `INV-${id.slice(-4).toUpperCase()}`,
    status: stringValue(row.status) || "sent",
    issuedAt: stringValue(row.issuedAt) || null,
    dueAt: stringValue(row.dueAt) || null,
    subtotal: numberValue(row.subtotal),
    discount: numberValue(row.discount),
    tax: numberValue(row.tax),
    total: numberValue(row.total),
    amountPaid: numberValue(row.amountPaid),
    balanceDue: numberValue(row.balanceDue),
    notes: stringValue(row.notes),
    jobId: stringValue(row.jobId) || null,
    jobNumber: stringValue(row.jobNumber) || null,
    invoiceType: stringValue(row.invoiceType) === "change_order" ? "change_order" : "standard",
    changeOrderId: stringValue(row.changeOrderId) || null,
    changeOrderNumber: stringValue(row.changeOrderNumber),
    changeOrderTitle: stringValue(row.changeOrderTitle),
    items: itemsRaw.flatMap((item) => {
      const entry = asRecord(item);
      if (!entry) return [];
      const mapped: CustomerInvoiceItem = {
        id: stringValue(entry.id) || undefined,
        description: stringValue(entry.description) || "Line item",
        kind: stringValue(entry.kind) || "labor",
        quantity: numberValue(entry.quantity),
        unitPrice: numberValue(entry.unitPrice),
        taxRate: numberValue(entry.taxRate),
        total: numberValue(entry.total),
      };
      return [mapped];
    }),
    payments: (Array.isArray(row.payments) ? row.payments : []).flatMap(
      (item) => {
        const entry = asRecord(item);
        if (!entry) return [];
        const paymentId = stringValue(entry.id);
        if (!paymentId) return [];
        const mapped: CustomerInvoicePayment = {
          id: paymentId,
          amount: numberValue(entry.amount),
          method: stringValue(entry.method) || "check",
          status: stringValue(entry.status) || "succeeded",
          paidAt: stringValue(entry.paidAt) || null,
          dueAt: stringValue(entry.dueAt) || stringValue(entry.paidAt) || null,
          createdAt: stringValue(entry.createdAt) || null,
          notes: stringValue(entry.notes),
          transactionReference: stringValue(entry.transactionReference),
          proofUrl: stringValue(entry.proofUrl),
        };
        return [mapped];
      },
    ),
    createdAt: stringValue(row.createdAt) || undefined,
    updatedAt: stringValue(row.updatedAt) || undefined,
    provider: provider
      ? {
          id: stringValue(provider.id),
          companyName: stringValue(provider.companyName),
          slug: stringValue(provider.slug),
          phone: stringValue(provider.phone),
          email: stringValue(provider.email),
        }
      : null,
  };
}

function mapPayment(raw: unknown): CustomerInvoicePayment | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const paymentId = stringValue(entry.id) || stringValue(entry._id);
  if (!paymentId) return null;
  const methodRaw = stringValue(entry.method).toLowerCase();
  const method =
    methodRaw === "card" || methodRaw === "ach" || methodRaw === "cash"
      ? methodRaw
      : methodRaw || "check";
  const statusRaw = stringValue(entry.status).toLowerCase();
  const status =
    statusRaw === "pending" ||
    statusRaw === "processing" ||
    statusRaw === "failed" ||
    statusRaw === "refunded"
      ? statusRaw
      : statusRaw || "succeeded";
  return {
    id: paymentId,
    amount: numberValue(entry.amount),
    method,
    status,
    paidAt: stringValue(entry.paidAt) || null,
    createdAt: stringValue(entry.createdAt) || null,
    notes: stringValue(entry.notes) || undefined,
    transactionReference: stringValue(entry.transactionReference) || undefined,
    proofUrl: stringValue(entry.proofUrl) || undefined,
  };
}

export const fetchCustomerInvoices = createAsyncThunk(
  "customerInvoices/fetchList",
  async (arg: CustomerInvoicesQuery | void, { rejectWithValue }) => {
    try {
      const params =
        arg && arg.page != null
          ? {
              page: Math.max(1, Number(arg.page) || 1),
              limit: Number(arg.limit) || CUSTOMER_INVOICES_PAGE_LIMIT,
              search: String(arg.search || "").trim() || undefined,
            }
          : undefined;
      // force: bypass the 45s GET cache so every tab visit refreshes in the background.
      const response = await getData(userApi.invoices, params, { force: true, silent: true });
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const listRaw = Array.isArray(data?.invoices) ? data.invoices : [];
      const items = listRaw
        .map(mapInvoice)
        .filter((item): item is CustomerInvoice => Boolean(item));
      const page = asRecord(data?.pagination);
      const pagination: CustomerInvoicesPagination | null = page
        ? {
            page: Number(page.page) || 1,
            limit: Number(page.limit) || CUSTOMER_INVOICES_PAGE_LIMIT,
            total: Number(page.total) || 0,
            totalPages: Math.max(1, Number(page.totalPages) || 1),
          }
        : null;
      return { items, pagination };
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load invoices.",
      );
    }
  },
);

export const fetchCustomerInvoiceDetail = createAsyncThunk(
  "customerInvoices/fetchDetail",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await getData(userApi.invoice(id));
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const invoice = mapInvoice(data?.invoice ?? data);
      if (!invoice) {
        return rejectWithValue("Invoice not found.");
      }
      return invoice;
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load invoice.",
      );
    }
  },
);

export const recordCustomerInvoicePayment = createAsyncThunk(
  "customerInvoices/recordPayment",
  async (
    { invoiceId, payment }: { invoiceId: string; payment: Partial<Payment> },
    { rejectWithValue }
  ) => {
    try {
      const response = await postData(userApi.recordInvoicePayment(invoiceId), payment);
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const savedPayment = mapPayment(data?.payment ?? data);
      if (!savedPayment) throw new Error("Invalid payment response");
      return {
        invoiceId,
        payment: savedPayment,
        invoice: mapInvoice(data?.invoice),
      };
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Failed to record payment",
      );
    }
  },
);

const customerInvoicesSlice = createSlice({
  name: "customerInvoices",
  initialState,
  reducers: {
    clearCustomerInvoices(state) {
      Object.assign(state, initialState);
    },
    clearCustomerInvoiceDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerInvoices.pending, (state) => {
        state.loading = !state.loaded;
        state.fetching = true;
        state.error = null;
      })
      .addCase(fetchCustomerInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.fetching = false;
        state.loaded = true;
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
        state.loadedKey = customerInvoicesKey(action.meta.arg);
      })
      .addCase(fetchCustomerInvoices.rejected, (state, action) => {
        state.loading = false;
        state.fetching = false;
        state.loaded = true;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load invoices.";
      })
      .addCase(fetchCustomerInvoiceDetail.pending, (state) => {
        state.detailLoading = !state.detail;
        state.detailError = null;
      })
      .addCase(fetchCustomerInvoiceDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchCustomerInvoiceDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detail = null;
        state.detailError =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load invoice.";
      })
      .addCase(recordCustomerInvoicePayment.fulfilled, (state, action) => {
        const { invoice, payment } = action.payload;
        if (state.detail && state.detail.id === invoice?.id) {
          state.detail = {
            ...state.detail,
            ...invoice,
            payments: [payment, ...(state.detail.payments || [])],
          };
        }
        const index = state.items.findIndex((item) => item.id === invoice?.id);
        if (index !== -1 && invoice) {
          state.items[index] = { ...state.items[index], ...invoice };
        }
      });
  },
});

export const { clearCustomerInvoices, clearCustomerInvoiceDetail } =
  customerInvoicesSlice.actions;

export const selectCustomerInvoices = (state: RootState) =>
  state.customerInvoices?.items ?? [];
export const selectCustomerInvoicesPagination = (state: RootState) =>
  state.customerInvoices?.pagination ?? null;
/**
 * Table spinner only when the table would show a different page/search (or on
 * first load). Refreshing the rows already on screen stays silent.
 */
export const selectCustomerInvoicesTableLoading =
  (arg: CustomerInvoicesQuery) => (state: RootState) =>
    Boolean(state.customerInvoices?.fetching) &&
    state.customerInvoices?.loadedKey !== customerInvoicesKey(arg);
export const selectCustomerInvoicesLoading = (state: RootState) =>
  Boolean(state.customerInvoices?.loading);
export const selectCustomerInvoiceDetail = (state: RootState) =>
  state.customerInvoices?.detail ?? null;
export const selectCustomerInvoiceDetailLoading = (state: RootState) =>
  Boolean(state.customerInvoices?.detailLoading);
export const selectCustomerInvoiceDetailError = (state: RootState) =>
  state.customerInvoices?.detailError ?? null;

export default customerInvoicesSlice.reducer;
