import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { userApi } from "@/components/api/ApiRoutesFile";
import type { RootState } from "@/store";

export type CustomerPayment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt?: string | null;
  notes?: string;
  transactionReference?: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus?: string | null;
  provider?: {
    id?: string;
    companyName?: string;
    slug?: string;
    phone?: string;
    email?: string;
  } | null;
};

type CustomerPaymentsState = {
  items: CustomerPayment[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  detail: CustomerPayment | null;
  detailLoading: boolean;
  detailError: string | null;
};

const initialState: CustomerPaymentsState = {
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

function mapPayment(raw: unknown): CustomerPayment | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = stringValue(row.id);
  if (!id) return null;
  const provider = asRecord(row.provider);
  return {
    id,
    amount: numberValue(row.amount),
    method: stringValue(row.method) || "check",
    status: stringValue(row.status) || "succeeded",
    paidAt: stringValue(row.paidAt) || null,
    createdAt: stringValue(row.createdAt) || null,
    notes: stringValue(row.notes),
    transactionReference: stringValue(row.transactionReference),
    invoiceId: stringValue(row.invoiceId) || null,
    invoiceNumber: stringValue(row.invoiceNumber) || null,
    invoiceStatus: stringValue(row.invoiceStatus) || null,
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

export const fetchCustomerPayments = createAsyncThunk(
  "customerPayments/fetchList",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getData(userApi.payments);
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const listRaw = Array.isArray(data?.payments) ? data.payments : [];
      return listRaw
        .map(mapPayment)
        .filter((item): item is CustomerPayment => Boolean(item));
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load payments.",
      );
    }
  },
);

export const fetchCustomerPaymentDetail = createAsyncThunk(
  "customerPayments/fetchDetail",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await getData(userApi.payment(id));
      const root = asRecord(response);
      const data = asRecord(root?.data) ?? root;
      const payment = mapPayment(data?.payment ?? data);
      if (!payment) {
        return rejectWithValue("Payment not found.");
      }
      return payment;
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Could not load payment.",
      );
    }
  },
);

const customerPaymentsSlice = createSlice({
  name: "customerPayments",
  initialState,
  reducers: {
    clearCustomerPayments(state) {
      Object.assign(state, initialState);
    },
    clearCustomerPaymentDetail(state) {
      state.detail = null;
      state.detailError = null;
      state.detailLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerPayments.pending, (state) => {
        state.loading = !state.loaded;
        state.error = null;
      })
      .addCase(fetchCustomerPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
      })
      .addCase(fetchCustomerPayments.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load payments.";
      })
      .addCase(fetchCustomerPaymentDetail.pending, (state) => {
        state.detailLoading = !state.detail;
        state.detailError = null;
      })
      .addCase(fetchCustomerPaymentDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload;
      })
      .addCase(fetchCustomerPaymentDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detail = null;
        state.detailError =
          typeof action.payload === "string"
            ? action.payload
            : "Could not load payment.";
      });
  },
});

export const { clearCustomerPayments, clearCustomerPaymentDetail } =
  customerPaymentsSlice.actions;

export const selectCustomerPayments = (state: RootState) =>
  state.customerPayments?.items ?? [];
export const selectCustomerPaymentsLoading = (state: RootState) =>
  Boolean(state.customerPayments?.loading);
export const selectCustomerPaymentsLoaded = (state: RootState) =>
  Boolean(state.customerPayments?.loaded);
export const selectCustomerPaymentDetail = (state: RootState) =>
  state.customerPayments?.detail ?? null;
export const selectCustomerPaymentDetailLoading = (state: RootState) =>
  Boolean(state.customerPayments?.detailLoading);
export const selectCustomerPaymentDetailError = (state: RootState) =>
  state.customerPayments?.detailError ?? null;

export default customerPaymentsSlice.reducer;
