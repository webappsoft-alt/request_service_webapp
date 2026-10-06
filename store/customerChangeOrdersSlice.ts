import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  listCustomerChangeOrders,
  type CustomerChangeOrder,
} from "@/lib/api/customer-change-orders";
import type { RootState } from "@/store";

/**
 * Customer job change orders — one cached list shared by the Change Orders tab,
 * the Orders table highlight, and the change order detail page.
 */
type CustomerChangeOrdersState = {
  items: CustomerChangeOrder[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: CustomerChangeOrdersState = {
  items: [],
  loading: false,
  loaded: false,
  error: null,
};

export const fetchCustomerChangeOrders = createAsyncThunk(
  "customerChangeOrders/fetch",
  async (_arg: void, { rejectWithValue }) => {
    try {
      return await listCustomerChangeOrders();
    } catch (err) {
      return rejectWithValue(
        extractErrorMessage(err) || "Failed to load change orders",
      );
    }
  },
  {
    condition: (_arg, { getState }) =>
      !(getState() as RootState).customerChangeOrders?.loading,
  },
);

const customerChangeOrdersSlice = createSlice({
  name: "customerChangeOrders",
  initialState,
  reducers: {
    upsertCustomerChangeOrder(state, action: PayloadAction<CustomerChangeOrder>) {
      const next = action.payload;
      const index = state.items.findIndex(
        (item) => item.id === next.id && String(item.jobId) === String(next.jobId),
      );
      if (index >= 0) state.items[index] = { ...state.items[index], ...next };
      else state.items.unshift(next);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomerChangeOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomerChangeOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.items = action.payload;
      })
      .addCase(fetchCustomerChangeOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload || "Failed to load change orders");
      });
  },
});

export const { upsertCustomerChangeOrder } = customerChangeOrdersSlice.actions;

export const selectCustomerChangeOrders = (state: RootState) =>
  state.customerChangeOrders?.items ?? [];
export const selectCustomerChangeOrdersLoading = (state: RootState) =>
  Boolean(state.customerChangeOrders?.loading);
export const selectCustomerChangeOrdersLoaded = (state: RootState) =>
  Boolean(state.customerChangeOrders?.loaded);

export function isPendingChangeOrderStatus(status: string) {
  return ["pending", "pending_approval"].includes(String(status || "").toLowerCase());
}

export default customerChangeOrdersSlice.reducer;
