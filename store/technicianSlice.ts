import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  changeTechnicianPassword,
  getTechnicianDashboard,
  getTechnicianEstimate,
  getTechnicianJob,
  getTechnicianProfile,
  listTechnicianEstimates,
  listTechnicianJobs,
  listTechnicianSchedule,
  updateTechnicianProfile,
  type Paginated,
  type TechDashboard,
  type TechEstimateDetail,
  type TechEstimateRow,
  type TechJobDetail,
  type TechJobRow,
  type TechListQuery,
  type TechProfile,
  type TechScheduleRow,
} from "@/lib/api/technician-client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications-client";

export const TECH_PAGE_SIZE = 20;

/** Sections with their own nav badge, and the notification types that feed each. */
export const TECH_SECTION_TYPES = {
  jobs: ["JOB_ASSIGNED", "JOB_UPDATED"],
  estimates: ["ESTIMATE_ASSIGNED", "ESTIMATE_UPDATED"],
  schedule: ["SCHEDULE_UPDATED"],
} as const;
export type TechSection = keyof typeof TECH_SECTION_TYPES;
export type TechRefreshScope = TechSection | "dashboard";

type ListState<T> = {
  key: string;
  data: Paginated<T> | null;
  loading: boolean;
  error: string | null;
};

type DetailState<T> = Record<string, { data: T | null; loading: boolean; error: string | null }>;

export type TechnicianState = {
  dashboard: { data: TechDashboard | null; loading: boolean; error: string | null };
  jobs: ListState<TechJobRow>;
  jobDetails: DetailState<TechJobDetail>;
  estimates: ListState<TechEstimateRow>;
  estimateDetails: DetailState<TechEstimateDetail>;
  schedule: { key: string; items: TechScheduleRow[]; loading: boolean; loaded: boolean; error: string | null };
  profile: { data: TechProfile | null; loading: boolean; saving: boolean; error: string | null };
  notifications: { items: AppNotification[]; unread: number; loaded: boolean; loading: boolean };
  /** Bumped by socket `technician:refresh` so mounted views refetch only what changed. */
  versions: Record<TechRefreshScope, number>;
};

const emptyList = <T,>(): ListState<T> => ({ key: "", data: null, loading: false, error: null });

const initialState: TechnicianState = {
  dashboard: { data: null, loading: false, error: null },
  jobs: emptyList<TechJobRow>(),
  jobDetails: {},
  estimates: emptyList<TechEstimateRow>(),
  estimateDetails: {},
  schedule: { key: "", items: [], loading: false, loaded: false, error: null },
  profile: { data: null, loading: false, saving: false, error: null },
  notifications: { items: [], unread: 0, loaded: false, loading: false },
  versions: { dashboard: 0, jobs: 0, estimates: 0, schedule: 0 },
};

type RootLike = { technician: TechnicianState };

export function techListKey(query: TechListQuery) {
  return [query.page || 1, query.limit || TECH_PAGE_SIZE, query.search?.trim() || "", query.status || "", query.scope || "all"].join("|");
}

/* ───────────────────────────── Thunks ───────────────────────────── */

export const fetchTechDashboard = createAsyncThunk<TechDashboard, void, { rejectValue: string }>(
  "technician/dashboard",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getTechnicianDashboard();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchTechJobs = createAsyncThunk<
  { key: string; data: Paginated<TechJobRow> },
  TechListQuery & { force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "technician/jobs",
  async (query, { rejectWithValue }) => {
    try {
      return { key: techListKey(query), data: await listTechnicianJobs(query) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) => {
      const list = getState().technician?.jobs;
      return Boolean(query.force || !list || list.key !== techListKey(query) || !list.data);
    },
  },
);

export const fetchTechJob = createAsyncThunk<TechJobDetail, string, { rejectValue: string }>(
  "technician/job",
  async (id, { rejectWithValue }) => {
    try {
      return await getTechnicianJob(id);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchTechEstimates = createAsyncThunk<
  { key: string; data: Paginated<TechEstimateRow> },
  TechListQuery & { force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "technician/estimates",
  async (query, { rejectWithValue }) => {
    try {
      return { key: techListKey(query), data: await listTechnicianEstimates(query) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) => {
      const list = getState().technician?.estimates;
      return Boolean(query.force || !list || list.key !== techListKey(query) || !list.data);
    },
  },
);

export const fetchTechEstimate = createAsyncThunk<TechEstimateDetail, string, { rejectValue: string }>(
  "technician/estimate",
  async (id, { rejectWithValue }) => {
    try {
      return await getTechnicianEstimate(id);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchTechSchedule = createAsyncThunk<
  { key: string; items: TechScheduleRow[] },
  { startDate: string; endDate: string; force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "technician/schedule",
  async ({ startDate, endDate }, { rejectWithValue }) => {
    try {
      return { key: `${startDate}|${endDate}`, items: await listTechnicianSchedule({ startDate, endDate }) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: ({ startDate, endDate, force }, { getState }) => {
      const schedule = getState().technician?.schedule;
      return Boolean(force || !schedule?.loaded || schedule.key !== `${startDate}|${endDate}`);
    },
  },
);

export const fetchTechProfile = createAsyncThunk<TechProfile, void, { rejectValue: string }>(
  "technician/profile",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getTechnicianProfile();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const saveTechProfile = createAsyncThunk<
  TechProfile,
  Parameters<typeof updateTechnicianProfile>[0],
  { rejectValue: string }
>("technician/saveProfile", async (patch, { rejectWithValue }) => {
  try {
    return await updateTechnicianProfile(patch);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const changeTechPassword = createAsyncThunk<
  void,
  { currentPassword: string; newPassword: string },
  { rejectValue: string }
>("technician/password", async (body, { rejectWithValue }) => {
  try {
    await changeTechnicianPassword(body);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** Loaded once per session; the socket keeps it current afterwards. */
export const fetchTechNotifications = createAsyncThunk<
  { items: AppNotification[]; unread: number },
  { force?: boolean } | void,
  { state: RootLike; rejectValue: string }
>(
  "technician/notifications",
  async (_arg, { rejectWithValue }) => {
    try {
      const result = await fetchNotifications({ page: 1, limit: 50, status: "all", silent: true, force: true });
      return { items: result.items, unread: result.unreadCount };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (arg, { getState }) => {
      const n = getState().technician?.notifications;
      if (n?.loading) return false;
      return Boolean((arg && arg.force) || !n?.loaded);
    },
  },
);

export const markTechNotificationRead = createAsyncThunk<{ id: string; unread: number }, string, { rejectValue: string }>(
  "technician/markRead",
  async (id, { rejectWithValue }) => {
    try {
      const result = await markNotificationRead(id);
      return { id, unread: result.unreadCount };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const markAllTechNotificationsRead = createAsyncThunk<void, void, { rejectValue: string }>(
  "technician/markAllRead",
  async (_arg, { rejectWithValue }) => {
    try {
      await markAllNotificationsRead();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

/**
 * Opening a section (Jobs / Estimates / Schedule) clears that section's badge,
 * mirroring the provider "Leads tab opened" behaviour.
 */
export const markTechSectionRead = createAsyncThunk<string[], TechSection, { state: RootLike }>(
  "technician/markSectionRead",
  async (section, { getState }) => {
    const types = TECH_SECTION_TYPES[section] as readonly string[];
    const ids = getState()
      .technician.notifications.items.filter((item) => !item.isRead && types.includes(item.type))
      .map((item) => item.id);
    await Promise.allSettled(ids.map((id) => markNotificationRead(id)));
    return ids;
  },
  {
    condition: (section, { getState }) => {
      const types = TECH_SECTION_TYPES[section] as readonly string[];
      return getState().technician.notifications.items.some((item) => !item.isRead && types.includes(item.type));
    },
  },
);

/* ───────────────────────────── Slice ───────────────────────────── */

function markRead(state: TechnicianState, ids: string[]) {
  const set = new Set(ids);
  let cleared = 0;
  state.notifications.items = state.notifications.items.map((item) => {
    if (!set.has(item.id) || item.isRead) return item;
    cleared += 1;
    return { ...item, isRead: true, readAt: new Date().toISOString() };
  });
  state.notifications.unread = Math.max(0, state.notifications.unread - cleared);
}

const technicianSlice = createSlice({
  name: "technician",
  initialState,
  reducers: {
    /** Socket NEW_NOTIFICATION. */
    techNotificationReceived(state, action: PayloadAction<AppNotification>) {
      const item = action.payload;
      if (state.notifications.items.some((row) => row.id === item.id)) return;
      state.notifications.items = [item, ...state.notifications.items].slice(0, 50);
      if (!item.isRead) state.notifications.unread += 1;
    },
    /** Socket `technician:refresh` — bump versions so mounted views refetch. */
    techRefreshRequested(state, action: PayloadAction<string[] | undefined>) {
      const scopes = action.payload?.length ? action.payload : ["dashboard"];
      for (const scope of scopes) {
        if (scope in state.versions) state.versions[scope as TechRefreshScope] += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTechDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchTechDashboard.fulfilled, (state, action) => {
        state.dashboard = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchTechDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload || "Could not load your dashboard.";
      })

      .addCase(fetchTechJobs.pending, (state, action) => {
        const key = techListKey(action.meta.arg);
        if (state.jobs.key !== key) state.jobs.data = null;
        state.jobs.key = key;
        state.jobs.loading = true;
        state.jobs.error = null;
      })
      .addCase(fetchTechJobs.fulfilled, (state, action) => {
        if (action.payload.key !== state.jobs.key) return;
        state.jobs.data = action.payload.data;
        state.jobs.loading = false;
      })
      .addCase(fetchTechJobs.rejected, (state, action) => {
        state.jobs.loading = false;
        state.jobs.error = action.payload || "Could not load jobs.";
      })

      .addCase(fetchTechJob.pending, (state, action) => {
        const current = state.jobDetails[action.meta.arg];
        state.jobDetails[action.meta.arg] = { data: current?.data ?? null, loading: true, error: null };
      })
      .addCase(fetchTechJob.fulfilled, (state, action) => {
        state.jobDetails[action.meta.arg] = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchTechJob.rejected, (state, action) => {
        state.jobDetails[action.meta.arg] = {
          data: state.jobDetails[action.meta.arg]?.data ?? null,
          loading: false,
          error: action.payload || "Job not found.",
        };
      })

      .addCase(fetchTechEstimates.pending, (state, action) => {
        const key = techListKey(action.meta.arg);
        if (state.estimates.key !== key) state.estimates.data = null;
        state.estimates.key = key;
        state.estimates.loading = true;
        state.estimates.error = null;
      })
      .addCase(fetchTechEstimates.fulfilled, (state, action) => {
        if (action.payload.key !== state.estimates.key) return;
        state.estimates.data = action.payload.data;
        state.estimates.loading = false;
      })
      .addCase(fetchTechEstimates.rejected, (state, action) => {
        state.estimates.loading = false;
        state.estimates.error = action.payload || "Could not load estimates.";
      })

      .addCase(fetchTechEstimate.pending, (state, action) => {
        const current = state.estimateDetails[action.meta.arg];
        state.estimateDetails[action.meta.arg] = { data: current?.data ?? null, loading: true, error: null };
      })
      .addCase(fetchTechEstimate.fulfilled, (state, action) => {
        state.estimateDetails[action.meta.arg] = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchTechEstimate.rejected, (state, action) => {
        state.estimateDetails[action.meta.arg] = {
          data: state.estimateDetails[action.meta.arg]?.data ?? null,
          loading: false,
          error: action.payload || "Estimate not found.",
        };
      })

      .addCase(fetchTechSchedule.pending, (state, action) => {
        const key = `${action.meta.arg.startDate}|${action.meta.arg.endDate}`;
        if (state.schedule.key !== key) state.schedule.items = [];
        state.schedule.key = key;
        state.schedule.loading = true;
        state.schedule.error = null;
      })
      .addCase(fetchTechSchedule.fulfilled, (state, action) => {
        if (action.payload.key !== state.schedule.key) return;
        state.schedule.items = action.payload.items;
        state.schedule.loading = false;
        state.schedule.loaded = true;
      })
      .addCase(fetchTechSchedule.rejected, (state, action) => {
        state.schedule.loading = false;
        state.schedule.error = action.payload || "Could not load your schedule.";
      })

      .addCase(fetchTechProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchTechProfile.fulfilled, (state, action) => {
        state.profile.data = action.payload;
        state.profile.loading = false;
      })
      .addCase(fetchTechProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload || "Could not load your profile.";
      })
      .addCase(saveTechProfile.pending, (state) => {
        state.profile.saving = true;
      })
      .addCase(saveTechProfile.fulfilled, (state, action) => {
        state.profile.data = action.payload;
        state.profile.saving = false;
      })
      .addCase(saveTechProfile.rejected, (state) => {
        state.profile.saving = false;
      })

      .addCase(fetchTechNotifications.pending, (state) => {
        state.notifications.loading = true;
      })
      .addCase(fetchTechNotifications.fulfilled, (state, action) => {
        state.notifications = {
          items: action.payload.items,
          unread: action.payload.unread,
          loaded: true,
          loading: false,
        };
      })
      .addCase(fetchTechNotifications.rejected, (state) => {
        state.notifications.loading = false;
        state.notifications.loaded = true;
      })
      .addCase(markTechNotificationRead.pending, (state, action) => {
        markRead(state, [action.meta.arg]);
      })
      .addCase(markTechNotificationRead.fulfilled, (state, action) => {
        state.notifications.unread = action.payload.unread;
      })
      .addCase(markAllTechNotificationsRead.pending, (state) => {
        markRead(
          state,
          state.notifications.items.map((item) => item.id),
        );
        state.notifications.unread = 0;
      })
      .addCase(markTechSectionRead.pending, (state, action) => {
        const types = TECH_SECTION_TYPES[action.meta.arg] as readonly string[];
        markRead(
          state,
          state.notifications.items.filter((item) => types.includes(item.type)).map((item) => item.id),
        );
      });
  },
});

export const { techNotificationReceived, techRefreshRequested } = technicianSlice.actions;

/** Unread notification count for a nav section badge. */
export function selectTechSectionBadge(state: RootLike, section: TechSection) {
  const types = TECH_SECTION_TYPES[section] as readonly string[];
  return state.technician?.notifications.items.filter((item) => !item.isRead && types.includes(item.type)).length ?? 0;
}

export default technicianSlice.reducer;
