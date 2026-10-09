import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  changeContractorPassword,
  getContractorBadges,
  getContractorDashboard,
  getContractorJob,
  getContractorProfile,
  updateContractorProfile,
  type ContractorProfileInput,
  listContractorChangeRequests,
  listContractorJobs,
  listContractorPayouts,
  markContractorSectionRead,
  submitContractorChangeRequest,
  submitContractorCompletion,
  type ContractorBadges,
  type ContractorDashboard,
  type ContractorJob,
  type ContractorJobDetail,
  type ContractorJobsQuery,
  type ContractorPayouts,
  type ContractorProfile,
  type ContractorRequest,
  type ContractorRequestListQuery,
  type ContractorSection,
  type Paginated,
} from "@/lib/api/contractor-portal-client";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications-client";

export const CONTRACTOR_PAGE_SIZE = 10;

/** Sections with their own sidebar badge, and the notification types that raise each. */
export const CONTRACTOR_SECTION_TYPES: Record<ContractorSection, readonly string[]> = {
  jobs: ["CONTRACTOR_JOB_ASSIGNED", "CONTRACTOR_JOB_UPDATED", "CONTRACTOR_WORK_REJECTED"],
  changeRequests: ["CONTRACTOR_CHANGE_REVIEWED"],
  payouts: ["CONTRACTOR_WORK_APPROVED", "CONTRACTOR_PAYMENT"],
};
export type ContractorRefreshScope = ContractorSection | "dashboard" | "schedule";

type ListState<T> = { key: string; data: Paginated<T> | null; loading: boolean; error: string | null };
type DetailState<T> = Record<string, { data: T | null; loading: boolean; error: string | null }>;

export type ContractorPortalState = {
  profile: { data: ContractorProfile | null; loading: boolean; error: string | null; saving?: boolean };
  dashboard: { data: ContractorDashboard | null; loading: boolean; error: string | null };
  jobs: ListState<ContractorJob>;
  jobDetails: DetailState<ContractorJobDetail>;
  changeRequests: ListState<ContractorRequest>;
  /** Earned / paid / balance per job + payment history. */
  payouts: { data: ContractorPayouts | null; loading: boolean; error: string | null };
  notifications: { items: AppNotification[]; unread: number; loaded: boolean; loading: boolean };
  /** Sidebar badges — separate from the bell; reset when a section is opened. */
  badges: ContractorBadges & { loaded: boolean };
  /** Bumped by socket `contractor:refresh` so mounted views refetch only what changed. */
  versions: Record<ContractorRefreshScope, number>;
};

const emptyList = <T,>(): ListState<T> => ({ key: "", data: null, loading: false, error: null });

const initialState: ContractorPortalState = {
  profile: { data: null, loading: false, error: null },
  dashboard: { data: null, loading: false, error: null },
  jobs: emptyList<ContractorJob>(),
  jobDetails: {},
  changeRequests: emptyList<ContractorRequest>(),
  payouts: { data: null, loading: false, error: null },
  notifications: { items: [], unread: 0, loaded: false, loading: false },
  badges: { jobs: 0, changeRequests: 0, payouts: 0, loaded: false },
  versions: { dashboard: 0, jobs: 0, changeRequests: 0, payouts: 0, schedule: 0 },
};

type RootLike = { contractorPortal: ContractorPortalState };

function jobsKey(query: ContractorJobsQuery) {
  return [query.page || 1, query.limit || CONTRACTOR_PAGE_SIZE, query.search?.trim() || "", query.status || "all"].join("|");
}

function requestsKey(query: ContractorRequestListQuery) {
  return [query.page || 1, query.limit || CONTRACTOR_PAGE_SIZE, query.search?.trim() || "", query.status || "all"].join("|");
}

/* ───────────────────────────── Thunks ───────────────────────────── */

export const fetchContractorProfile = createAsyncThunk<ContractorProfile, void, { rejectValue: string }>(
  "contractorPortal/profile",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getContractorProfile();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const saveContractorProfile = createAsyncThunk<ContractorProfile, ContractorProfileInput, { rejectValue: string }>(
  "contractorPortal/saveProfile",
  async (input, { rejectWithValue }) => {
    try {
      return await updateContractorProfile(input);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchContractorDashboard = createAsyncThunk<ContractorDashboard, void, { rejectValue: string }>(
  "contractorPortal/dashboard",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getContractorDashboard();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchContractorJobs = createAsyncThunk<
  { key: string; data: Paginated<ContractorJob> },
  ContractorJobsQuery & { force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "contractorPortal/jobs",
  async (query, { rejectWithValue }) => {
    try {
      return { key: jobsKey(query), data: await listContractorJobs({ limit: CONTRACTOR_PAGE_SIZE, ...query }) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) => {
      const list = getState().contractorPortal?.jobs;
      return Boolean(query.force || !list || list.key !== jobsKey(query) || !list.data);
    },
  },
);

export const fetchContractorJob = createAsyncThunk<ContractorJobDetail, string, { rejectValue: string }>(
  "contractorPortal/job",
  async (id, { rejectWithValue }) => {
    try {
      return await getContractorJob(id);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchContractorChangeRequests = createAsyncThunk<
  { key: string; data: Paginated<ContractorRequest> },
  ContractorRequestListQuery & { force?: boolean },
  { state: RootLike; rejectValue: string }
>(
  "contractorPortal/changeRequests",
  async (query, { rejectWithValue }) => {
    try {
      return { key: requestsKey(query), data: await listContractorChangeRequests(query) };
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (query, { getState }) => {
      const list = getState().contractorPortal?.changeRequests;
      return Boolean(query.force || !list || list.key !== requestsKey(query) || !list.data);
    },
  },
);

export const fetchContractorPayouts = createAsyncThunk<ContractorPayouts, void, { rejectValue: string }>(
  "contractorPortal/payouts",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listContractorPayouts();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

/**
 * "Mark as complete". The job card flips to `pending_pro_approval` right away
 * (optimistic) and rolls back if the API rejects the submission.
 */
export const submitJobCompletion = createAsyncThunk<
  ContractorRequest,
  { jobId: string; photos: string[]; notes?: string },
  { rejectValue: string }
>("contractorPortal/submitCompletion", async ({ jobId, photos, notes }, { rejectWithValue }) => {
  try {
    return await submitContractorCompletion(jobId, { photos, notes });
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const submitChangeRequest = createAsyncThunk<
  ContractorRequest,
  { jobId: string; description: string; reason: string },
  { rejectValue: string }
>("contractorPortal/submitChangeRequest", async ({ jobId, ...input }, { rejectWithValue }) => {
  try {
    return await submitContractorChangeRequest(jobId, input);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateContractorPassword = createAsyncThunk<
  void,
  { currentPassword: string; newPassword: string },
  { rejectValue: string }
>("contractorPortal/password", async (input, { rejectWithValue }) => {
  try {
    await changeContractorPassword(input);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** Loaded once per session; the socket keeps it current afterwards. */
export const fetchContractorNotifications = createAsyncThunk<
  { items: AppNotification[]; unread: number },
  { force?: boolean } | void,
  { state: RootLike; rejectValue: string }
>(
  "contractorPortal/notifications",
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
      const n = getState().contractorPortal?.notifications;
      if (n?.loading) return false;
      return Boolean((arg && arg.force) || !n?.loaded);
    },
  },
);

export const markContractorNotificationRead = createAsyncThunk<
  { id: string; unread: number },
  string,
  { rejectValue: string }
>("contractorPortal/markRead", async (id, { rejectWithValue }) => {
  try {
    const result = await markNotificationRead(id);
    return { id, unread: result.unreadCount };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const markAllContractorNotificationsRead = createAsyncThunk<void, void, { rejectValue: string }>(
  "contractorPortal/markAllRead",
  async (_arg, { rejectWithValue }) => {
    try {
      await markAllNotificationsRead();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

export const fetchContractorBadges = createAsyncThunk<ContractorBadges, void, { rejectValue: string }>(
  "contractorPortal/badges",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getContractorBadges();
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

/**
 * Opening a section resets its sidebar badge — optimistically to 0, then the
 * server persists "last opened" so a refresh never brings old counts back.
 * On failure the previous count is restored.
 */
export const markContractorSectionSeen = createAsyncThunk<
  ContractorBadges,
  ContractorSection,
  { state: RootLike; rejectValue: string }
>(
  "contractorPortal/markSectionRead",
  async (section, { rejectWithValue }) => {
    try {
      return await markContractorSectionRead(section);
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
  {
    condition: (section, { getState }) => {
      const badges = getState().contractorPortal?.badges;
      return Boolean(badges?.loaded && badges[section] > 0);
    },
  },
);

/* ───────────────────────────── Slice ───────────────────────────── */

function markRead(state: ContractorPortalState, ids: string[]) {
  const set = new Set(ids);
  let cleared = 0;
  state.notifications.items = state.notifications.items.map((item) => {
    if (!set.has(item.id) || item.isRead) return item;
    cleared += 1;
    return { ...item, isRead: true, readAt: new Date().toISOString() };
  });
  state.notifications.unread = Math.max(0, state.notifications.unread - cleared);
}

/** Apply a completion submission to every cached copy of the job. */
function setJobCompletion(state: ContractorPortalState, jobId: string, completion: ContractorJob["completion"]) {
  const apply = (job: ContractorJob) => {
    if (job.id === jobId) job.completion = completion;
  };
  state.jobs.data?.items.forEach(apply);
  state.dashboard.data?.upcoming.forEach(apply);
  const detail = state.jobDetails[jobId]?.data;
  if (detail) detail.job.completion = completion;
}

/** Remembered while a completion is in flight so a failure can roll back. */
const previousCompletion = new Map<string, ContractorJob["completion"]>();
/** Badge count before an optimistic section reset. */
const previousBadge = new Map<ContractorSection, number>();

const contractorPortalSlice = createSlice({
  name: "contractorPortal",
  initialState,
  reducers: {
    /** Socket NEW_NOTIFICATION. */
    contractorNotificationReceived(state, action: PayloadAction<AppNotification>) {
      const item = action.payload;
      if (state.notifications.items.some((row) => row.id === item.id)) return;
      state.notifications.items = [item, ...state.notifications.items].slice(0, 50);
      if (!item.isRead) state.notifications.unread += 1;
      for (const [section, types] of Object.entries(CONTRACTOR_SECTION_TYPES)) {
        if (types.includes(item.type)) state.badges[section as ContractorSection] += 1;
      }
    },
    /** Socket `contractor:refresh` — bump versions so mounted views refetch. */
    contractorRefreshRequested(state, action: PayloadAction<string[] | undefined>) {
      const scopes = action.payload?.length ? action.payload : ["dashboard"];
      for (const scope of scopes) {
        if (scope in state.versions) state.versions[scope as ContractorRefreshScope] += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContractorProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchContractorProfile.fulfilled, (state, action) => {
        state.profile = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchContractorProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload || "Could not load your profile.";
      })
      .addCase(saveContractorProfile.pending, (state) => {
        state.profile.saving = true;
      })
      .addCase(saveContractorProfile.fulfilled, (state, action) => {
        state.profile = { data: action.payload, loading: false, error: null, saving: false };
      })
      .addCase(saveContractorProfile.rejected, (state) => {
        state.profile.saving = false;
      })

      .addCase(fetchContractorDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchContractorDashboard.fulfilled, (state, action) => {
        state.dashboard = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchContractorDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload || "Could not load your dashboard.";
      })

      .addCase(fetchContractorJobs.pending, (state, action) => {
        const key = jobsKey(action.meta.arg);
        if (state.jobs.key !== key) state.jobs.data = null;
        state.jobs.key = key;
        state.jobs.loading = true;
        state.jobs.error = null;
      })
      .addCase(fetchContractorJobs.fulfilled, (state, action) => {
        if (action.payload.key !== state.jobs.key) return;
        state.jobs.data = action.payload.data;
        state.jobs.loading = false;
      })
      .addCase(fetchContractorJobs.rejected, (state, action) => {
        state.jobs.loading = false;
        state.jobs.error = action.payload || "Could not load your jobs.";
      })

      .addCase(fetchContractorJob.pending, (state, action) => {
        const current = state.jobDetails[action.meta.arg];
        state.jobDetails[action.meta.arg] = { data: current?.data ?? null, loading: true, error: null };
      })
      .addCase(fetchContractorJob.fulfilled, (state, action) => {
        state.jobDetails[action.meta.arg] = { data: action.payload, loading: false, error: null };
      })
      .addCase(fetchContractorJob.rejected, (state, action) => {
        state.jobDetails[action.meta.arg] = {
          data: state.jobDetails[action.meta.arg]?.data ?? null,
          loading: false,
          error: action.payload || "Job not found.",
        };
      })

      .addCase(fetchContractorChangeRequests.pending, (state, action) => {
        const key = requestsKey(action.meta.arg);
        if (state.changeRequests.key !== key) state.changeRequests.data = null;
        state.changeRequests.key = key;
        state.changeRequests.loading = true;
        state.changeRequests.error = null;
      })
      .addCase(fetchContractorChangeRequests.fulfilled, (state, action) => {
        if (action.payload.key !== state.changeRequests.key) return;
        state.changeRequests.data = action.payload.data;
        state.changeRequests.loading = false;
      })
      .addCase(fetchContractorChangeRequests.rejected, (state, action) => {
        state.changeRequests.loading = false;
        state.changeRequests.error = action.payload || "Could not load change requests.";
      })

      .addCase(fetchContractorPayouts.pending, (state) => {
        state.payouts.loading = true;
        state.payouts.error = null;
      })
      .addCase(fetchContractorPayouts.fulfilled, (state, action) => {
        state.payouts.data = action.payload;
        state.payouts.loading = false;
      })
      .addCase(fetchContractorPayouts.rejected, (state, action) => {
        state.payouts.loading = false;
        state.payouts.error = action.payload || "Could not load your earnings.";
      })

      .addCase(submitJobCompletion.pending, (state, action) => {
        const { jobId } = action.meta.arg;
        const current =
          state.jobDetails[jobId]?.data?.job.completion ??
          state.jobs.data?.items.find((job) => job.id === jobId)?.completion ??
          null;
        previousCompletion.set(jobId, current);
        setJobCompletion(state, jobId, {
          id: `optimistic-${action.meta.requestId}`,
          status: "pending_pro_approval",
          reviewNote: "",
          submittedAt: new Date().toISOString(),
          reviewedAt: null,
        });
        if (state.dashboard.data) state.dashboard.data.counts.awaitingApproval += 1;
      })
      .addCase(submitJobCompletion.fulfilled, (state, action) => {
        const { jobId } = action.meta.arg;
        const request = action.payload;
        previousCompletion.delete(jobId);
        setJobCompletion(state, jobId, {
          id: request.id,
          status: request.status,
          reviewNote: request.reviewNote,
          submittedAt: request.createdAt,
          reviewedAt: request.reviewedAt,
        });
        const detail = state.jobDetails[jobId]?.data;
        if (detail) detail.completions = [request, ...detail.completions];
      })
      .addCase(submitJobCompletion.rejected, (state, action) => {
        const { jobId } = action.meta.arg;
        setJobCompletion(state, jobId, previousCompletion.get(jobId) ?? null);
        previousCompletion.delete(jobId);
        if (state.dashboard.data) {
          state.dashboard.data.counts.awaitingApproval = Math.max(0, state.dashboard.data.counts.awaitingApproval - 1);
        }
      })

      .addCase(submitChangeRequest.fulfilled, (state, action) => {
        const { jobId } = action.meta.arg;
        const detail = state.jobDetails[jobId]?.data;
        if (detail) {
          detail.changeRequests = [action.payload, ...detail.changeRequests];
          detail.job.pendingChangeRequests += 1;
        }
        const row = state.jobs.data?.items.find((job) => job.id === jobId);
        if (row) row.pendingChangeRequests += 1;
        if (state.dashboard.data) state.dashboard.data.counts.openChangeRequests += 1;
        // Lists keyed by query refetch on next visit.
        state.changeRequests.key = "";
      })

      .addCase(fetchContractorNotifications.pending, (state) => {
        state.notifications.loading = true;
      })
      .addCase(fetchContractorNotifications.fulfilled, (state, action) => {
        state.notifications = { items: action.payload.items, unread: action.payload.unread, loaded: true, loading: false };
      })
      .addCase(fetchContractorNotifications.rejected, (state) => {
        state.notifications.loading = false;
        state.notifications.loaded = true;
      })
      .addCase(markContractorNotificationRead.pending, (state, action) => {
        markRead(state, [action.meta.arg]);
      })
      .addCase(markContractorNotificationRead.fulfilled, (state, action) => {
        state.notifications.unread = action.payload.unread;
      })
      .addCase(markAllContractorNotificationsRead.pending, (state) => {
        markRead(
          state,
          state.notifications.items.map((item) => item.id),
        );
        state.notifications.unread = 0;
      })

      .addCase(fetchContractorBadges.fulfilled, (state, action) => {
        state.badges = { ...action.payload, loaded: true };
      })
      .addCase(fetchContractorBadges.rejected, (state) => {
        state.badges.loaded = true;
      })
      .addCase(markContractorSectionSeen.pending, (state, action) => {
        previousBadge.set(action.meta.arg, state.badges[action.meta.arg]);
        state.badges[action.meta.arg] = 0;
      })
      .addCase(markContractorSectionSeen.rejected, (state, action) => {
        // Server didn't persist the reset — put the count back so it isn't silently lost.
        state.badges[action.meta.arg] += previousBadge.get(action.meta.arg) ?? 0;
        previousBadge.delete(action.meta.arg);
      })
      .addCase(markContractorSectionSeen.fulfilled, (state, action) => {
        previousBadge.delete(action.meta.arg);
        // Keep the open section at 0 even if an event raced in.
        state.badges = { ...action.payload, [action.meta.arg]: 0, loaded: true };
      });
  },
});

export const { contractorNotificationReceived, contractorRefreshRequested } = contractorPortalSlice.actions;

/** Sidebar badge for a section (new since last opened — independent of the bell). */
export function selectContractorSectionBadge(state: RootLike, section: ContractorSection) {
  return state.contractorPortal?.badges?.[section] ?? 0;
}

export default contractorPortalSlice.reducer;
