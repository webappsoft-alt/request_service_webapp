import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData } from "@/components/api/sliceHttp";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";

/**
 * Pro wallet balance — read-only, calculated by the API from the ledger:
 * collected customer invoice payments − technician payouts − contractor payouts − expenses.
 * Nothing here can change it; payouts are checked against it on the server.
 */
export type ProviderWallet = {
  balance: number;
  collected: number;
  paymentsCount: number;
  /** Customer-entered payments waiting for the Pro's confirmation — not in the balance. */
  awaitingConfirmation: number;
  awaitingConfirmationCount: number;
  technicianPayouts: number;
  contractorPayouts: number;
  payoutsCount: number;
  expenses: number;
  paidOut: number;
  currency: string;
  asOf: string;
};

type ProviderWalletState = {
  data: ProviderWallet | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const initialState: ProviderWalletState = {
  data: null,
  loading: false,
  loaded: false,
  error: null,
};

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseWallet(response: unknown): ProviderWallet {
  const root = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  const raw = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  return {
    balance: toNumber(raw.balance),
    collected: toNumber(raw.collected),
    paymentsCount: toNumber(raw.paymentsCount),
    awaitingConfirmation: toNumber(raw.awaitingConfirmation),
    awaitingConfirmationCount: toNumber(raw.awaitingConfirmationCount),
    technicianPayouts: toNumber(raw.technicianPayouts),
    contractorPayouts: toNumber(raw.contractorPayouts),
    payoutsCount: toNumber(raw.payoutsCount),
    expenses: toNumber(raw.expenses),
    paidOut: toNumber(raw.paidOut),
    currency: typeof raw.currency === "string" ? raw.currency : "USD",
    asOf: typeof raw.asOf === "string" ? raw.asOf : new Date().toISOString(),
  };
}

/** Money changes often (payments, payouts) — callers pass `force` to always read the latest. */
export const fetchProviderWallet = createAsyncThunk<
  ProviderWallet,
  { force?: boolean } | undefined,
  { state: { providerWallet: ProviderWalletState }; rejectValue: string }
>(
  "providerWallet/fetch",
  async (_arg, { rejectWithValue }) => {
    try {
      return parseWallet(await getData(providerCrmApi.wallet, undefined, { silent: true }));
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const state = getState().providerWallet;
      if (state.loading) return false;
      return Boolean(arg?.force) || !state.loaded;
    },
  },
);

const providerWalletSlice = createSlice({
  name: "providerWallet",
  initialState,
  reducers: {
    resetProviderWallet() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviderWallet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviderWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.data = action.payload;
      })
      .addCase(fetchProviderWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || "Could not load the wallet balance.";
      });
  },
});

export const { resetProviderWallet } = providerWalletSlice.actions;
export default providerWalletSlice.reducer;
