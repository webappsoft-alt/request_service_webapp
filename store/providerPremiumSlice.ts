import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import { getData, postData } from "@/components/api/sliceHttp";
import { providerCrmApi } from "@/components/api/ApiRoutesFile";

/**
 * Premium Business Profile for the signed-in Pro. The API owns every rule (price, wallet check,
 * renewals); this slice only shows the status and sends the Pro's choice.
 */
export type PremiumCharge = {
  id: string;
  number: string;
  kind: "purchase" | "renewal" | "grant";
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  durationDays: number;
  createdAt: string;
};

export type ProviderPremium = {
  isPremium: boolean;
  expiresAt: string | null;
  since: string | null;
  autoRenew: boolean;
  settings: { isEnabled: boolean; monthlyPrice: number; durationDays: number; currency: string };
  subscription: {
    id: string;
    status: "active" | "cancelled" | "expired";
    autoRenew: boolean;
    currentPeriodEnd: string;
    price: number;
    durationDays: number;
    totalPaid: number;
    chargesCount: number;
    endReason: string;
    /** paid = bought from the wallet; admin_grant = given free by Request Service (doesn't renew). */
    source: "paid" | "admin_grant";
    grantedDays: number;
  } | null;
  walletBalance: number;
  canAfford: boolean;
  charges: PremiumCharge[];
};

type PremiumAction = "subscribe" | "cancel" | "resume";

type ProviderPremiumState = {
  data: ProviderPremium | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  /** The action being sent (buttons show a spinner). */
  acting: PremiumAction | null;
};

const initialState: ProviderPremiumState = {
  data: null,
  loading: false,
  loaded: false,
  error: null,
  acting: null,
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parseProviderPremium(response: unknown): ProviderPremium {
  const root = record(response);
  const raw = root.data && typeof root.data === "object" ? record(root.data) : root;
  const settings = record(raw.settings);
  const sub = raw.subscription && typeof raw.subscription === "object" ? record(raw.subscription) : null;
  const status = str(sub?.status);
  return {
    isPremium: Boolean(raw.isPremium),
    expiresAt: str(raw.expiresAt) || null,
    since: str(raw.since) || null,
    autoRenew: Boolean(raw.autoRenew),
    settings: {
      isEnabled: Boolean(settings.isEnabled),
      monthlyPrice: num(settings.monthlyPrice),
      durationDays: num(settings.durationDays) || 30,
      currency: str(settings.currency) || "USD",
    },
    subscription: sub
      ? {
          id: str(sub.id),
          status: status === "active" || status === "cancelled" ? status : "expired",
          autoRenew: Boolean(sub.autoRenew),
          currentPeriodEnd: str(sub.currentPeriodEnd),
          price: num(sub.price),
          durationDays: num(sub.durationDays) || 30,
          totalPaid: num(sub.totalPaid),
          chargesCount: num(sub.chargesCount),
          endReason: str(sub.endReason),
          source: sub.source === "admin_grant" ? "admin_grant" : "paid",
          grantedDays: num(sub.grantedDays),
        }
      : null,
    walletBalance: num(raw.walletBalance),
    canAfford: Boolean(raw.canAfford),
    charges: (Array.isArray(raw.charges) ? raw.charges : []).map((item) => {
      const c = record(item);
      return {
        id: str(c.id),
        number: str(c.number),
        kind: c.kind === "renewal" ? "renewal" : c.kind === "grant" ? "grant" : "purchase",
        amount: num(c.amount),
        currency: str(c.currency) || "USD",
        periodStart: str(c.periodStart),
        periodEnd: str(c.periodEnd),
        durationDays: num(c.durationDays),
        createdAt: str(c.createdAt),
      };
    }),
  };
}

type ThunkApi = { state: { providerPremium: ProviderPremiumState }; rejectValue: string };

export const fetchProviderPremium = createAsyncThunk<ProviderPremium, { force?: boolean } | undefined, ThunkApi>(
  "providerPremium/fetch",
  async (arg, { rejectWithValue }) => {
    try {
      return parseProviderPremium(
        await getData(providerCrmApi.premium, undefined, { silent: true, force: Boolean(arg?.force) }),
      );
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const state = getState().providerPremium;
      if (state.loading) return false;
      return Boolean(arg?.force) || !state.loaded;
    },
  },
);

function premiumAction<A>(type: PremiumAction, endpoint: string, body: (arg: A) => unknown) {
  return createAsyncThunk<ProviderPremium, A, ThunkApi>(
    `providerPremium/${type}`,
    async (arg, { rejectWithValue }) => {
      try {
        // Errors are shown in the dialog, so no global toast (silent). The caller refreshes the wallet.
        return parseProviderPremium(await postData(endpoint, body(arg), { silent: true }));
      } catch (error) {
        return rejectWithValue(extractErrorMessage(error));
      }
    },
  );
}

export const subscribeProviderPremium = premiumAction<{ expectedPrice: number }>(
  "subscribe",
  providerCrmApi.premiumSubscribe,
  (arg) => ({ expectedPrice: arg.expectedPrice }),
);
export const cancelProviderPremium = premiumAction<{ reason?: string }>(
  "cancel",
  providerCrmApi.premiumCancel,
  (arg) => ({ reason: arg.reason || "" }),
);
export const resumeProviderPremium = premiumAction<void>("resume", providerCrmApi.premiumResume, () => ({}));

const providerPremiumSlice = createSlice({
  name: "providerPremium",
  initialState,
  reducers: {
    resetProviderPremium() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProviderPremium.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviderPremium.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.data = action.payload;
      })
      .addCase(fetchProviderPremium.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || "Could not load Premium status.";
      });

    const actions = [
      ["subscribe", subscribeProviderPremium],
      ["cancel", cancelProviderPremium],
      ["resume", resumeProviderPremium],
    ] as const;
    for (const [name, thunk] of actions) {
      builder
        .addCase(thunk.pending, (state) => {
          state.acting = name;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.acting = null;
          state.loaded = true;
          state.data = action.payload;
        })
        .addCase(thunk.rejected, (state) => {
          state.acting = null;
        });
    }
  },
});

export const { resetProviderPremium } = providerPremiumSlice.actions;
export default providerPremiumSlice.reducer;
