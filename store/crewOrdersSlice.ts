import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { listCrewOrders, type CrewOrderListRow, type CrewPortal } from "@/lib/api/order-crew-client";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";

/**
 * Fixed-price orders assigned to the signed-in technician / contractor — one shared copy for the
 * Jobs list, the Jobs nav badge and its hover card. Previously each of those called the API on
 * its own (several identical requests per page load / socket event).
 */

type PortalOrders = {
  rows: CrewOrderListRow[] | null;
  loading: boolean;
  error: string | null;
  loadedAt: number;
};

export type CrewOrdersState = Record<CrewPortal, PortalOrders>;

const empty = (): PortalOrders => ({ rows: null, loading: false, error: null, loadedAt: 0 });

const initialState: CrewOrdersState = { technician: empty(), contractor: empty() };

/** Reuse a list loaded in the last 30 s unless `force` (socket update / manual refresh). */
const FRESH_MS = 30_000;

type RootLike = { crewOrders?: CrewOrdersState };

export const fetchCrewOrders = createAsyncThunk<
  CrewOrderListRow[],
  { portal: CrewPortal; force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "crewOrders/fetch",
  async ({ portal }, { rejectWithValue }) => {
    try {
      return await listCrewOrders(portal);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ portal, force }, { getState }) => {
      const slot = getState().crewOrders?.[portal];
      if (!slot) return true;
      if (slot.loading) return false; // one request at a time
      if (force) return true;
      return !slot.rows || Date.now() - slot.loadedAt > FRESH_MS;
    },
  },
);

const crewOrdersSlice = createSlice({
  name: "crewOrders",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCrewOrders.pending, (state, action) => {
        state[action.meta.arg.portal].loading = true;
      })
      .addCase(fetchCrewOrders.fulfilled, (state, action) => {
        const slot = state[action.meta.arg.portal];
        slot.rows = action.payload;
        slot.loading = false;
        slot.error = null;
        slot.loadedAt = Date.now();
      })
      .addCase(fetchCrewOrders.rejected, (state, action) => {
        const slot = state[action.meta.arg.portal];
        slot.loading = false;
        if (action.meta.condition) return;
        slot.error = action.payload || "Could not load your jobs.";
      });
  },
});

export const selectCrewOrders = (state: RootLike, portal: CrewPortal) => state.crewOrders?.[portal] ?? empty();

export default crewOrdersSlice.reducer;
