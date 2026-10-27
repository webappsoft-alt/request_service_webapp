import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  dayWindow,
  getLiveLocations,
  getWorkerRoute,
  type LiveWorker,
  type RoutePoint,
  type WorkerRoute,
} from "@/lib/tracking";

/**
 * Employee tracking cache (dashboard map + Tracking page). Positions are kept per day and routes
 * per worker + day, so coming back shows the last data straight away while a fresh copy loads
 * in the background; socket updates move markers / extend routes in place.
 */
type LiveDayState = {
  items: LiveWorker[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

type RouteState = {
  route: WorkerRoute | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type TrackingState = {
  live: Record<string, LiveDayState>;
  routes: Record<string, RouteState>;
};

const initialState: TrackingState = { live: {}, routes: {} };

type RootLike = { tracking?: TrackingState };

export function routeKey(workerId: string, dateKey: string) {
  return `${workerId}|${dateKey}`;
}

/** Everyone's last position on a day. Always refreshes (background when cached); one request at a time. */
export const fetchLiveWorkers = createAsyncThunk<
  { dateKey: string; items: LiveWorker[] },
  { dateKey: string },
  { state: RootLike; rejectValue: string }
>(
  "tracking/fetchLive",
  async ({ dateKey }, { rejectWithValue }) => {
    try {
      return { dateKey, items: await getLiveLocations(dayWindow(dateKey)) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  { condition: ({ dateKey }, { getState }) => !getState().tracking?.live[dateKey]?.loading },
);

/** One worker's route for a day. Always refreshes (background when cached); one request at a time. */
export const fetchWorkerRoute = createAsyncThunk<
  { key: string; route: WorkerRoute },
  { workerId: string; dateKey: string },
  { state: RootLike; rejectValue: string }
>(
  "tracking/fetchRoute",
  async ({ workerId, dateKey }, { rejectWithValue }) => {
    try {
      return { key: routeKey(workerId, dateKey), route: await getWorkerRoute(workerId, dayWindow(dateKey)) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ workerId, dateKey }, { getState }) =>
      !getState().tracking?.routes[routeKey(workerId, dateKey)]?.loading,
  },
);

function liveDay(state: TrackingState, dateKey: string) {
  if (!state.live[dateKey]) state.live[dateKey] = { items: [], loading: false, loaded: false, error: null };
  return state.live[dateKey];
}

function routeEntry(state: TrackingState, key: string) {
  if (!state.routes[key]) state.routes[key] = { route: null, loading: false, loaded: false, error: null };
  return state.routes[key];
}

const trackingSlice = createSlice({
  name: "tracking",
  initialState,
  reducers: {
    /** Socket WORKER_LOCATION_UPDATED applied to a day's markers (see `applyLocationUpdate`). */
    liveWorkersUpdated(state, action: PayloadAction<{ dateKey: string; items: LiveWorker[] }>) {
      liveDay(state, action.payload.dateKey).items = action.payload.items;
    },
    /** Socket position for the worker whose route is open: extend the line without a refetch. */
    routePointAppended(state, action: PayloadAction<{ key: string; point: RoutePoint }>) {
      const entry = state.routes[action.payload.key];
      if (!entry?.route) return;
      entry.route.points.push(action.payload.point);
      entry.route.totalPoints += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLiveWorkers.pending, (state, action) => {
        const day = liveDay(state, action.meta.arg.dateKey);
        day.loading = true;
        day.error = null;
      })
      .addCase(fetchLiveWorkers.fulfilled, (state, action) => {
        const day = liveDay(state, action.payload.dateKey);
        day.items = action.payload.items;
        day.loading = false;
        day.loaded = true;
      })
      .addCase(fetchLiveWorkers.rejected, (state, action) => {
        const day = liveDay(state, action.meta.arg.dateKey);
        day.loading = false;
        // Keep the last positions on a failed background refresh.
        day.error = action.payload || "Could not load team locations.";
      })
      .addCase(fetchWorkerRoute.pending, (state, action) => {
        const entry = routeEntry(state, routeKey(action.meta.arg.workerId, action.meta.arg.dateKey));
        entry.loading = true;
        entry.error = null;
      })
      .addCase(fetchWorkerRoute.fulfilled, (state, action) => {
        const entry = routeEntry(state, action.payload.key);
        entry.route = action.payload.route;
        entry.loading = false;
        entry.loaded = true;
      })
      .addCase(fetchWorkerRoute.rejected, (state, action) => {
        const entry = routeEntry(state, routeKey(action.meta.arg.workerId, action.meta.arg.dateKey));
        entry.loading = false;
        entry.error = action.payload || "Could not load the route.";
      });
  },
});

export const { liveWorkersUpdated, routePointAppended } = trackingSlice.actions;

const EMPTY_LIVE: LiveDayState = { items: [], loading: false, loaded: false, error: null };
const EMPTY_ROUTE: RouteState = { route: null, loading: false, loaded: false, error: null };

export const selectLiveDay = (state: RootLike, dateKey: string) => state.tracking?.live[dateKey] ?? EMPTY_LIVE;
export const selectRoute = (state: RootLike, key: string) => state.tracking?.routes[key] ?? EMPTY_ROUTE;

export default trackingSlice.reducer;
