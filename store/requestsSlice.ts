import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  assignSchedule,
  deleteSchedule,
  getCustomer,
  getInboxSummary,
  getRequest,
  listRequests,
  queryEstimates,
  queryJobs,
  queryReminders,
  queryRequests,
  querySchedule,
  queryTasks,
  updateRequestStatus,
  updateSchedule,
  type CrmInboxSummary,
  type CrmScheduleAssignment,
} from "@/lib/api/crm-client";
import type {
  PortalCustomerCrm,
  PortalReminder,
  PortalTask,
} from "@/lib/data/crm-people";
import type { PortalCalendarEvent, PortalRequest } from "@/lib/data/portal";
import type { Estimate, Job } from "@/lib/types";

export const REQUESTS_DEFAULT_LIMIT = 20;

export function requestsCacheKey(
  status = "",
  search = "",
  page = 1,
  limit = REQUESTS_DEFAULT_LIMIT,
) {
  return `${status.trim()}|${search.trim()}|${page}|${limit}`;
}

export function leadTabCacheKey(requestId?: string, customerId?: string) {
  return `${requestId || "none"}_${customerId || "none"}`;
}

export type RequestsState = {
  items: PortalRequest[];
  pagesCache: Record<string, PortalRequest[]>;
  detailsCache: Record<string, PortalRequest>;
  customerCache: Record<string, PortalCustomerCrm>;
  estimatesCache: Record<string, Estimate[]>;
  jobsCache: Record<string, Job[]>;
  tasksCache: Record<string, PortalTask[]>;
  remindersCache: Record<string, PortalReminder[]>;
  scheduleCache: Record<string, PortalCalendarEvent[]>;
  summary: CrmInboxSummary | null;
  tabsLoaded: {
    customer: Record<string, boolean>;
    estimates: Record<string, boolean>;
    jobs: Record<string, boolean>;
    tasks: Record<string, boolean>;
    reminders: Record<string, boolean>;
    schedule: Record<string, boolean>;
  };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  loading: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
  customerLoading: boolean;
  estimatesLoading: boolean;
  jobsLoading: boolean;
  tasksLoading: boolean;
  remindersLoading: boolean;
  scheduleLoading: boolean;
  summaryLoading: boolean;
  mutating: boolean;
};

const initialState: RequestsState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  customerCache: {},
  estimatesCache: {},
  jobsCache: {},
  tasksCache: {},
  remindersCache: {},
  scheduleCache: {},
  summary: null,
  tabsLoaded: {
    customer: {},
    estimates: {},
    jobs: {},
    tasks: {},
    reminders: {},
    schedule: {},
  },
  page: 1,
  limit: REQUESTS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  loading: false,
  error: null,
  detailLoading: false,
  detailError: null,
  customerLoading: false,
  estimatesLoading: false,
  jobsLoading: false,
  tasksLoading: false,
  remindersLoading: false,
  scheduleLoading: false,
  summaryLoading: false,
  mutating: false,
};

export const fetchRequests = createAsyncThunk<
  {
    items: PortalRequest[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    cacheKey: string;
  },
  {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    force?: boolean;
    silent?: boolean;
  } | void,
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().requests ?? initialState;
  const hasParams = params !== undefined && params !== null;
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const targetStatus = hasParams && "status" in params ? (params.status || "") : state.status;
  const targetSearch = hasParams && "search" in params ? (params.search || "") : state.search;
  const key = requestsCacheKey(targetStatus, targetSearch, targetPage, targetLimit);

  try {
    let resultItems: PortalRequest[] = [];
    let resultTotal = 0;
    let resultTotalPages = 1;

    try {
      const result = await queryRequests({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch.trim() || undefined,
        status: targetStatus.trim() || undefined,
        force: true,
        silent: params?.silent ?? true,
      });
      resultItems = result.items;
      resultTotal = result.total;
      resultTotalPages = result.totalPages;
    } catch {
      // Fallback to listRequests if queryRequests is unavailable
      resultItems = await listRequests({
        force: true,
        silent: params?.silent ?? true,
      });
      resultTotal = resultItems.length;
      resultTotalPages = 1;
    }

    return {
      items: resultItems,
      page: targetPage,
      total: resultTotal,
      totalPages: resultTotalPages,
      search: targetSearch,
      status: targetStatus,
      cacheKey: key,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchRequestDetail = createAsyncThunk<
  PortalRequest,
  string,
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const item = await getRequest(id, { silent: true, force: true });
    if (!item) return rejectWithValue("Lead not found.");
    return item;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadCustomer = createAsyncThunk<
  PortalCustomerCrm,
  string,
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchCustomer", async (customerId, { rejectWithValue }) => {
  try {
    const customer = await getCustomer(customerId);
    if (!customer) return rejectWithValue("Customer not found.");
    return customer;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadEstimates = createAsyncThunk<
  { key: string; items: Estimate[] },
  { requestId?: string; customerId?: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchEstimates", async ({ requestId, customerId }, { rejectWithValue }) => {
  const key = leadTabCacheKey(requestId, customerId);
  try {
    const result = await queryEstimates({
      requestId: requestId || undefined,
      customerId: customerId || undefined,
      limit: 20,
      force: true,
      silent: true,
    });
    return { key, items: result?.items ?? [] };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadJobs = createAsyncThunk<
  { key: string; items: Job[] },
  { requestId?: string; customerId?: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchJobs", async ({ requestId, customerId }, { rejectWithValue }) => {
  const key = leadTabCacheKey(requestId, customerId);
  try {
    const result = await queryJobs({
      requestId: requestId || undefined,
      customerId: customerId || undefined,
      limit: 20,
      force: true,
      silent: true,
    });
    return { key, items: result?.items ?? [] };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadTasks = createAsyncThunk<
  { key: string; items: PortalTask[] },
  { requestId?: string; customerId?: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchTasks", async ({ requestId, customerId }, { rejectWithValue }) => {
  const key = leadTabCacheKey(requestId, customerId);
  try {
    const result = await queryTasks({
      customerId: customerId || undefined,
      limit: 20,
      force: true,
      silent: true,
    });
    return { key, items: result?.items ?? [] };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadReminders = createAsyncThunk<
  { key: string; items: PortalReminder[] },
  { requestId?: string; customerId?: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchReminders", async ({ requestId, customerId }, { rejectWithValue }) => {
  const key = leadTabCacheKey(requestId, customerId);
  try {
    const result = await queryReminders({
      customerId: customerId || undefined,
      limit: 20,
      force: true,
      silent: true,
    });
    return { key, items: result?.items ?? [] };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchLeadStatus = createAsyncThunk<
  PortalRequest,
  { id: string; status: PortalRequest["status"] },
  { rejectValue: string }
>("requests/patchStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateRequestStatus(id, status);
    if (!updated) {
      return rejectWithValue("Failed to update status.");
    }
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchLeadSchedule = createAsyncThunk<
  { key: string; events: PortalCalendarEvent[] },
  { requestId: string; customerId?: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchSchedule", async ({ requestId, customerId }, { rejectWithValue }) => {
  const key = leadTabCacheKey(requestId, customerId);
  try {
    const list = await querySchedule({
      kind: "request",
      customerId: customerId || undefined,
      force: true,
      silent: true,
    });
    const matched = list.filter(
      (item) =>
        item.recordId === requestId ||
        item.id === requestId ||
        item.id === `cal_${requestId}`,
    );
    return { key, events: matched };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const bookLeadSchedule = createAsyncThunk<
  { key: string; event: PortalCalendarEvent },
  { key: string; assignment: CrmScheduleAssignment },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/bookSchedule", async ({ key, assignment }, { rejectWithValue }) => {
  try {
    const saved = await assignSchedule(assignment);
    if (!saved) return rejectWithValue("Failed to book schedule.");
    return { key, event: saved };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateLeadSchedule = createAsyncThunk<
  { key: string; event: PortalCalendarEvent },
  { id: string; key: string; data: Partial<CrmScheduleAssignment> },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/updateSchedule", async ({ id, key, data }, { rejectWithValue }) => {
  try {
    const updated = await updateSchedule(id, data);
    if (!updated) return rejectWithValue("Failed to update schedule.");
    return { key, event: updated };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteLeadSchedule = createAsyncThunk<
  { key: string; id: string },
  { id: string; key: string },
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/deleteSchedule", async ({ id, key }, { rejectWithValue }) => {
  try {
    await deleteSchedule(id);
    return { key, id };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchRequestsSummary = createAsyncThunk<
  CrmInboxSummary,
  { silent?: boolean } | undefined,
  { state: { requests: RequestsState }; rejectValue: string }
>("requests/fetchSummary", async (options, { rejectWithValue }) => {
  try {
    const summary = await getInboxSummary({
      silent: options?.silent ?? true,
      force: true,
    });
    return summary;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const requestsSlice = createSlice({
  name: "requests",
  initialState,
  reducers: {
    setRequestStatusLocal(
      state,
      action: PayloadAction<{ id: string; status: PortalRequest["status"] }>,
    ) {
      const { id, status } = action.payload;
      // Update details cache
      if (state.detailsCache[id]) {
        state.detailsCache[id] = { ...state.detailsCache[id], status };
      }
      // Update items list
      state.items = state.items.map((item) =>
        item.id === id ? { ...item, status } : item,
      );
      // Update pagesCache
      for (const k of Object.keys(state.pagesCache)) {
        state.pagesCache[k] = state.pagesCache[k].map((item) =>
          item.id === id ? { ...item, status } : item,
        );
      }
    },
    upsertRequestItem(state, action: PayloadAction<PortalRequest>) {
      const req = action.payload;
      state.detailsCache[req.id] = req;
      const idx = state.items.findIndex((item) => item.id === req.id);
      if (idx >= 0) {
        state.items[idx] = req;
      } else {
        state.items.unshift(req);
        state.total += 1;
      }
      for (const k of Object.keys(state.pagesCache)) {
        const pIdx = state.pagesCache[k].findIndex((item) => item.id === req.id);
        if (pIdx >= 0) {
          state.pagesCache[k][pIdx] = req;
        } else {
          state.pagesCache[k] = [req, ...state.pagesCache[k]];
        }
      }
    },
    upsertLeadTask(
      state,
      action: PayloadAction<{ key: string; task: PortalTask }>,
    ) {
      const { key, task } = action.payload;
      const list = state.tasksCache[key] ?? [];
      const idx = list.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        list[idx] = task;
      } else {
        list.unshift(task);
      }
      state.tasksCache[key] = [...list];
    },
    removeLeadTask(
      state,
      action: PayloadAction<{ key: string; taskId: string }>,
    ) {
      const { key, taskId } = action.payload;
      if (state.tasksCache[key]) {
        state.tasksCache[key] = state.tasksCache[key].filter((t) => t.id !== taskId);
      }
    },
    upsertLeadReminder(
      state,
      action: PayloadAction<{ key: string; reminder: PortalReminder }>,
    ) {
      const { key, reminder } = action.payload;
      const list = state.remindersCache[key] ?? [];
      const idx = list.findIndex((r) => r.id === reminder.id);
      if (idx >= 0) {
        list[idx] = reminder;
      } else {
        list.unshift(reminder);
      }
      state.remindersCache[key] = [...list];
    },
    removeLeadReminder(
      state,
      action: PayloadAction<{ key: string; reminderId: string }>,
    ) {
      const { key, reminderId } = action.payload;
      if (state.remindersCache[key]) {
        state.remindersCache[key] = state.remindersCache[key].filter((r) => r.id !== reminderId);
      }
    },
    upsertLeadEstimate(
      state,
      action: PayloadAction<{ key: string; estimate: Estimate }>,
    ) {
      const { key, estimate } = action.payload;
      const list = state.estimatesCache[key] ?? [];
      const idx = list.findIndex((e) => e.id === estimate.id);
      if (idx >= 0) {
        list[idx] = estimate;
      } else {
        list.unshift(estimate);
      }
      state.estimatesCache[key] = [...list];
    },
    upsertLeadJob(
      state,
      action: PayloadAction<{ key: string; job: Job }>,
    ) {
      const { key, job } = action.payload;
      const list = state.jobsCache[key] ?? [];
      const idx = list.findIndex((j) => j.id === job.id);
      if (idx >= 0) {
        list[idx] = job;
      } else {
        list.unshift(job);
      }
      state.jobsCache[key] = [...list];
    },
    upsertLeadScheduleLocal(
      state,
      action: PayloadAction<{ key: string; event: PortalCalendarEvent }>,
    ) {
      const { key, event } = action.payload;
      const list = state.scheduleCache[key] ?? [];
      const idx = list.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        list[idx] = event;
      } else {
        list.push(event);
      }
      state.scheduleCache[key] = [...list];
    },
    removeLeadScheduleLocal(
      state,
      action: PayloadAction<{ key: string; id?: string }>,
    ) {
      const { key, id } = action.payload;
      if (state.scheduleCache[key]) {
        if (id) {
          state.scheduleCache[key] = state.scheduleCache[key].filter((e) => e.id !== id);
        } else {
          state.scheduleCache[key] = [];
        }
      }
    },
    setLeadScheduleLocal(
      state,
      action: PayloadAction<{ key: string; events: PortalCalendarEvent[] }>,
    ) {
      state.scheduleCache[action.payload.key] = action.payload.events;
    },
    setRequestsSummaryLocal(
      state,
      action: PayloadAction<CrmInboxSummary>,
    ) {
      state.summary = action.payload;
    },
    clearRequestsCache(state) {
      state.pagesCache = {};
      state.detailsCache = {};
      state.customerCache = {};
      state.estimatesCache = {};
      state.jobsCache = {};
      state.tasksCache = {};
      state.remindersCache = {};
      state.scheduleCache = {};
      state.summary = null;
      state.tabsLoaded = {
        customer: {},
        estimates: {},
        jobs: {},
        tasks: {},
        reminders: {},
        schedule: {},
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchRequests
      .addCase(fetchRequests.pending, (state, action) => {
        state.error = null;
        const targetPage = action.meta.arg?.page ?? state.page;
        const targetLimit = action.meta.arg?.limit ?? state.limit;
        const targetStatus = action.meta.arg && "status" in action.meta.arg ? (action.meta.arg.status || "") : state.status;
        const targetSearch = action.meta.arg && "search" in action.meta.arg ? (action.meta.arg.search || "") : state.search;
        const key = requestsCacheKey(targetStatus, targetSearch, targetPage, targetLimit);

        if (state.pagesCache[key] && state.pagesCache[key].length >= 0) {
          state.items = state.pagesCache[key];
          state.loading = false;
        } else if (state.items.length === 0) {
          state.loading = true;
        }
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.pagesCache[action.payload.cacheKey] = action.payload.items;
        state.page = action.payload.page;
        state.total = action.payload.total;
        state.totalPages = action.payload.totalPages;
        state.search = action.payload.search;
        state.status = action.payload.status;
        // Warm up details cache with retrieved items
        for (const item of action.payload.items) {
          if (!state.detailsCache[item.id]) {
            state.detailsCache[item.id] = item;
          }
        }
      })
      .addCase(fetchRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch leads";
      })

      // fetchRequestDetail
      .addCase(fetchRequestDetail.pending, (state, action) => {
        state.detailError = null;
        const id = action.meta.arg;
        if (!state.detailsCache[id]) {
          state.detailLoading = true;
        }
      })
      .addCase(fetchRequestDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        const item = action.payload;
        state.detailsCache[item.id] = item;
        // Update in items list if present
        const idx = state.items.findIndex((x) => x.id === item.id);
        if (idx >= 0) {
          state.items[idx] = item;
        }
      })
      .addCase(fetchRequestDetail.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload ?? "Failed to fetch lead details";
      })

      // fetchLeadCustomer
      .addCase(fetchLeadCustomer.pending, (state, action) => {
        const id = action.meta.arg;
        if (!state.customerCache[id]) {
          state.customerLoading = true;
        }
      })
      .addCase(fetchLeadCustomer.fulfilled, (state, action) => {
        state.customerLoading = false;
        state.customerCache[action.payload.id] = action.payload;
        state.tabsLoaded.customer[action.payload.id] = true;
      })
      .addCase(fetchLeadCustomer.rejected, (state) => {
        state.customerLoading = false;
      })

      // fetchLeadEstimates
      .addCase(fetchLeadEstimates.pending, (state, action) => {
        const key = leadTabCacheKey(action.meta.arg?.requestId, action.meta.arg?.customerId);
        if (!state.estimatesCache[key]) {
          state.estimatesLoading = true;
        }
      })
      .addCase(fetchLeadEstimates.fulfilled, (state, action) => {
        state.estimatesLoading = false;
        state.estimatesCache[action.payload.key] = action.payload.items;
        state.tabsLoaded.estimates[action.payload.key] = true;
      })
      .addCase(fetchLeadEstimates.rejected, (state) => {
        state.estimatesLoading = false;
      })

      // fetchLeadJobs
      .addCase(fetchLeadJobs.pending, (state, action) => {
        const key = leadTabCacheKey(action.meta.arg?.requestId, action.meta.arg?.customerId);
        if (!state.jobsCache[key]) {
          state.jobsLoading = true;
        }
      })
      .addCase(fetchLeadJobs.fulfilled, (state, action) => {
        state.jobsLoading = false;
        state.jobsCache[action.payload.key] = action.payload.items;
        state.tabsLoaded.jobs[action.payload.key] = true;
      })
      .addCase(fetchLeadJobs.rejected, (state) => {
        state.jobsLoading = false;
      })

      // fetchLeadTasks
      .addCase(fetchLeadTasks.pending, (state, action) => {
        const key = leadTabCacheKey(action.meta.arg?.requestId, action.meta.arg?.customerId);
        if (!state.tasksCache[key]) {
          state.tasksLoading = true;
        }
      })
      .addCase(fetchLeadTasks.fulfilled, (state, action) => {
        state.tasksLoading = false;
        state.tasksCache[action.payload.key] = action.payload.items;
        state.tabsLoaded.tasks[action.payload.key] = true;
      })
      .addCase(fetchLeadTasks.rejected, (state) => {
        state.tasksLoading = false;
      })

      // fetchLeadReminders
      .addCase(fetchLeadReminders.pending, (state, action) => {
        const key = leadTabCacheKey(action.meta.arg?.requestId, action.meta.arg?.customerId);
        if (!state.remindersCache[key]) {
          state.remindersLoading = true;
        }
      })
      .addCase(fetchLeadReminders.fulfilled, (state, action) => {
        state.remindersLoading = false;
        state.remindersCache[action.payload.key] = action.payload.items;
        state.tabsLoaded.reminders[action.payload.key] = true;
      })
      .addCase(fetchLeadReminders.rejected, (state) => {
        state.remindersLoading = false;
      })

      // patchLeadStatus
      .addCase(patchLeadStatus.fulfilled, (state, action) => {
        const req = action.payload;
        if (req?.id) {
          state.detailsCache[req.id] = req;
          state.items = state.items.map((item) =>
            item.id === req.id ? req : item,
          );
          for (const k of Object.keys(state.pagesCache)) {
            state.pagesCache[k] = state.pagesCache[k].map((item) =>
              item.id === req.id ? req : item,
            );
          }
        }
      })

      // fetchLeadSchedule
      .addCase(fetchLeadSchedule.pending, (state, action) => {
        const key = leadTabCacheKey(action.meta.arg?.requestId, action.meta.arg?.customerId);
        if (state.scheduleCache[key] === undefined) {
          state.scheduleLoading = true;
        }
      })
      .addCase(fetchLeadSchedule.fulfilled, (state, action) => {
        state.scheduleLoading = false;
        state.scheduleCache[action.payload.key] = action.payload.events;
        state.tabsLoaded.schedule[action.payload.key] = true;
      })
      .addCase(fetchLeadSchedule.rejected, (state) => {
        state.scheduleLoading = false;
      })

      // bookLeadSchedule
      .addCase(bookLeadSchedule.fulfilled, (state, action) => {
        const list = state.scheduleCache[action.payload.key] ?? [];
        const idx = list.findIndex((e) => e.id === action.payload.event.id);
        if (idx >= 0) {
          list[idx] = action.payload.event;
        } else {
          list.push(action.payload.event);
        }
        state.scheduleCache[action.payload.key] = [...list];
        state.tabsLoaded.schedule[action.payload.key] = true;
      })

      // updateLeadSchedule
      .addCase(updateLeadSchedule.fulfilled, (state, action) => {
        const list = state.scheduleCache[action.payload.key] ?? [];
        const idx = list.findIndex((e) => e.id === action.payload.event.id);
        if (idx >= 0) {
          list[idx] = action.payload.event;
        } else {
          list.push(action.payload.event);
        }
        state.scheduleCache[action.payload.key] = [...list];
      })

      // deleteLeadSchedule
      .addCase(deleteLeadSchedule.fulfilled, (state, action) => {
        if (state.scheduleCache[action.payload.key]) {
          state.scheduleCache[action.payload.key] = state.scheduleCache[action.payload.key].filter(
            (e) => e.id !== action.payload.id,
          );
        }
      })

      // fetchRequestsSummary
      .addCase(fetchRequestsSummary.pending, (state) => {
        if (!state.summary) {
          state.summaryLoading = true;
        }
      })
      .addCase(fetchRequestsSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.summary = action.payload;
      })
      .addCase(fetchRequestsSummary.rejected, (state) => {
        state.summaryLoading = false;
      });
  },
});

export const {
  setRequestStatusLocal,
  upsertRequestItem,
  upsertLeadTask,
  removeLeadTask,
  upsertLeadReminder,
  removeLeadReminder,
  upsertLeadEstimate,
  upsertLeadJob,
  upsertLeadScheduleLocal,
  setLeadScheduleLocal,
  removeLeadScheduleLocal,
  setRequestsSummaryLocal,
  clearRequestsCache,
} = requestsSlice.actions;

export default requestsSlice.reducer;
