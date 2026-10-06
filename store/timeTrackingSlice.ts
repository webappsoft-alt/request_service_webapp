import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  clockIn,
  clockOut,
  getTechnicianActiveEntry,
  listProviderTimeEntries,
  listTechnicianTimeEntries,
  providerStopTimeEntry,
  type ClockTarget,
  type ProviderTimeQuery,
  type TimeEntriesPage,
} from "@/lib/api/technician-client";
import { EMPTY_TIME_SUMMARY, type TimeEntry, type TimeSummary } from "@/lib/time-tracking";

/**
 * Time tracking lists keyed by scope so the same data powers every view:
 * - `tech`            technician's own entries (Time Tracking tab)
 * - `employee:<id>`   provider → employee detail
 * - `job:<id>`        provider → job detail
 */
export type TimeListState = {
  filterKey: string;
  items: TimeEntry[];
  summary: TimeSummary;
  overall?: TimeSummary;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type TimeTrackingState = {
  lists: Record<string, TimeListState>;
  /** Technician's running timer (persisted server-side; survives refresh). */
  active: TimeEntry | null;
  activeLoaded: boolean;
  clocking: boolean;
  clockError: string | null;
  /** Bumped on every clock-in/out (local or socket) so open views refetch totals. */
  version: number;
  /** `id:status` of the last applied entry — drops the socket echo of our own action. */
  lastEntryKey: string;
};

const initialState: TimeTrackingState = {
  lists: {},
  active: null,
  activeLoaded: false,
  clocking: false,
  clockError: null,
  version: 0,
  lastEntryKey: "",
};

function emptyList(filterKey = ""): TimeListState {
  return {
    filterKey,
    items: [],
    summary: EMPTY_TIME_SUMMARY,
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    loading: false,
    loaded: false,
    error: null,
  };
}

export function timeFilterKey(query: ProviderTimeQuery) {
  return [query.from || "", query.to || "", query.page || 1, query.limit || 20].join("|");
}

type RootLike = { timeTracking: TimeTrackingState };

export const fetchTimeEntries = createAsyncThunk<
  { scopeKey: string; filterKey: string; result: TimeEntriesPage },
  { scopeKey: string; query: ProviderTimeQuery; technician?: boolean; force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "timeTracking/fetchList",
  async ({ scopeKey, query, technician }, { rejectWithValue }) => {
    try {
      const result = technician
        ? await listTechnicianTimeEntries(query)
        : await listProviderTimeEntries(query);
      return { scopeKey, filterKey: timeFilterKey(query), result };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ scopeKey, query, force }, { getState }) => {
      const list = getState().timeTracking?.lists[scopeKey];
      if (!list || force) return true;
      if (list.loading && list.filterKey === timeFilterKey(query)) return false;
      return !(list.loaded && list.filterKey === timeFilterKey(query));
    },
  },
);

export const fetchActiveEntry = createAsyncThunk<TimeEntry | null, { force?: boolean } | void, { state: RootLike; rejectValue: string }>(
  "timeTracking/fetchActive",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getTechnicianActiveEntry();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => Boolean((arg && arg.force) || !getState().timeTracking?.activeLoaded),
  },
);

export const clockInThunk = createAsyncThunk<TimeEntry | null, { target: ClockTarget; notes?: string }, { rejectValue: string }>(
  "timeTracking/clockIn",
  async ({ target, notes }, { rejectWithValue }) => {
    try {
      return await clockIn(target, notes);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const clockOutThunk = createAsyncThunk<TimeEntry | null, { target: ClockTarget | null; notes?: string }, { rejectValue: string }>(
  "timeTracking/clockOut",
  async ({ target, notes }, { rejectWithValue }) => {
    try {
      return await clockOut(target, notes);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

/** Provider: stop a technician's forgotten timer. */
export const stopTimeEntryThunk = createAsyncThunk<TimeEntry | null, string, { rejectValue: string }>(
  "timeTracking/providerStop",
  async (id, { rejectWithValue }) => {
    try {
      return await providerStopTimeEntry(id);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

function applyEntry(state: TimeTrackingState, entry: TimeEntry, { technician }: { technician: boolean }) {
  const key = `${entry.id}:${entry.status}`;
  if (state.lastEntryKey === key) return;
  state.lastEntryKey = key;
  if (technician) {
    if (entry.status === "active") state.active = entry;
    else if (state.active?.id === entry.id) state.active = null;
    state.activeLoaded = true;
  }
  for (const list of Object.values(state.lists)) {
    const idx = list.items.findIndex((row) => row.id === entry.id);
    if (idx >= 0) list.items[idx] = entry;
  }
  state.version += 1;
}

const timeTrackingSlice = createSlice({
  name: "timeTracking",
  initialState,
  reducers: {
    /** Socket TIME_ENTRY_UPDATED (another tab/device, or the office). */
    timeEntryReceived(state, action: PayloadAction<{ entry: TimeEntry; technician: boolean }>) {
      applyEntry(state, action.payload.entry, { technician: action.payload.technician });
    },
    clearTimeList(state, action: PayloadAction<string>) {
      delete state.lists[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTimeEntries.pending, (state, action) => {
        const { scopeKey, query } = action.meta.arg;
        const key = timeFilterKey(query);
        const list = state.lists[scopeKey] ?? emptyList(key);
        // Keep rows while refetching the same view; reset when the filter changes.
        if (list.filterKey !== key) {
          state.lists[scopeKey] = { ...emptyList(key), loading: true };
        } else {
          list.loading = true;
          list.error = null;
          state.lists[scopeKey] = list;
        }
      })
      .addCase(fetchTimeEntries.fulfilled, (state, action) => {
        const { scopeKey, filterKey, result } = action.payload;
        state.lists[scopeKey] = {
          filterKey,
          items: result.items,
          summary: result.summary,
          overall: result.overall ?? state.lists[scopeKey]?.overall,
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          loading: false,
          loaded: true,
          error: null,
        };
      })
      .addCase(fetchTimeEntries.rejected, (state, action) => {
        const list = state.lists[action.meta.arg.scopeKey];
        if (!list) return;
        list.loading = false;
        list.error = action.payload || "Could not load time entries.";
      })
      .addCase(fetchActiveEntry.fulfilled, (state, action) => {
        state.active = action.payload;
        state.activeLoaded = true;
      })
      .addCase(fetchActiveEntry.rejected, (state) => {
        state.activeLoaded = true;
      })
      .addCase(clockInThunk.pending, (state) => {
        state.clocking = true;
        state.clockError = null;
      })
      .addCase(clockInThunk.fulfilled, (state, action) => {
        state.clocking = false;
        if (action.payload) applyEntry(state, action.payload, { technician: true });
      })
      .addCase(clockInThunk.rejected, (state, action) => {
        state.clocking = false;
        state.clockError = action.payload || "Could not clock in.";
      })
      .addCase(clockOutThunk.pending, (state) => {
        state.clocking = true;
        state.clockError = null;
      })
      .addCase(clockOutThunk.fulfilled, (state, action) => {
        state.clocking = false;
        if (action.payload) applyEntry(state, action.payload, { technician: true });
        else state.active = null;
      })
      .addCase(clockOutThunk.rejected, (state, action) => {
        state.clocking = false;
        state.clockError = action.payload || "Could not clock out.";
      })
      .addCase(stopTimeEntryThunk.fulfilled, (state, action) => {
        if (action.payload) applyEntry(state, action.payload, { technician: false });
      });
  },
});

export const { timeEntryReceived, clearTimeList } = timeTrackingSlice.actions;

const EMPTY_LIST = emptyList();

export function selectTimeList(state: RootLike, scopeKey: string): TimeListState {
  return state.timeTracking?.lists[scopeKey] ?? EMPTY_LIST;
}

export default timeTrackingSlice.reducer;
