import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { userApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

export type CustomerInvoiceItem = {
  id?: string;
  description: string;
  kind: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
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
  items: CustomerInvoiceItem[];
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

type CustomerInvoicesState = {
  items: CustomerInvoice[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  detail: CustomerInvoice | null;
  detailLoading: boolean;
  detailError: string | null;
};

const initialState: CustomerInvoicesState = {
  items: [],
  loading: false,
  loaded: false,
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
    items: itemsRaw
      .map((item) => {
        const entry = asRecord(item);
        if (!entry) return null;
        return {
          id: stringValue(entry.id) || undefined,
          description: stringValue(entry.description) || "Line item",
          kind: stringValue(entry.kind) || "labor",
          quantity: numberValue(entry.quantity),
          unitPrice: numberValue(entry.unitPrice),
          taxRate: numberValue(entry.taxRate),
          total: numberValue(entry.total),
        };
      })
      .filter((item): item is CustomerInvoiceItem => Boolean(item)),
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

export const fetchCustomerInvoices = createAsyncThunk(
  "customerInvoices/fetchList",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(userApi.invoices);
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const listRaw = Array.isArray(data?.invoices) ? data.invoices : [];
      return listRaw
        .map(mapInvoice)
        .filter((item): item is CustomerInvoice => Boolean(item));
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
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomerInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
      })
      .addCase(fetchCustomerInvoices.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load invoices.";
      })
      .addCase(fetchCustomerInvoiceDetail.pending, (state) => {
        state.detailLoading = true;
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
      });
  },
});

export const { clearCustomerInvoices, clearCustomerInvoiceDetail } =
  customerInvoicesSlice.actions;

export const selectCustomerInvoices = (state: RootState) =>
  state.customerInvoices?.items ?? [];
export const selectCustomerInvoicesLoading = (state: RootState) =>
  Boolean(state.customerInvoices?.loading);
export const selectCustomerInvoiceDetail = (state: RootState) =>
  state.customerInvoices?.detail ?? null;
export const selectCustomerInvoiceDetailLoading = (state: RootState) =>
  Boolean(state.customerInvoices?.detailLoading);
export const selectCustomerInvoiceDetailError = (state: RootState) =>
  state.customerInvoices?.detailError ?? null;

export default customerInvoicesSlice.reducer;
