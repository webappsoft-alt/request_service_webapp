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
} from "@/lib/types/order-booking";
import type { PendingFixedOrder } from "@/lib/booking/pending-fixed-order";

type OrdersState = {
  availability: SlotAvailabilityResponse | null;
  availabilityLoading: boolean;
  availabilityError: string | null;
  checkoutLoading: boolean;
  checkoutError: string | null;
  lastCheckout: OrderCheckoutResult | null;
  /** In-session mirror of the pending checkout draft (also in sessionStorage). */
  pendingDraft: PendingFixedOrder | null;
};

const initialState: OrdersState = {
  availability: null,
  availabilityLoading: false,
  availabilityError: null,
  checkoutLoading: false,
  checkoutError: null,
  lastCheckout: null,
  pendingDraft: null,
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
      });
  },
});

export const {
  clearAvailability,
  clearCheckoutError,
  setPendingOrderDraft,
  clearPendingOrderDraft,
  resetOrders,
} = ordersSlice.actions;

export default ordersSlice.reducer;
