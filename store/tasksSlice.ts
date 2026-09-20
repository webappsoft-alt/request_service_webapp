import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createTask,
  deleteTask,
  getTask,
  queryTasks,
  updateTask,
  updateTaskStatus,
} from "@/lib/api/crm-client";
import type { PortalTask } from "@/lib/data/crm-people";

/** List page size for GET /provider/tasks */
export const TASKS_DEFAULT_LIMIT = 20;

type TasksState = {
  items: PortalTask[];
  pagesCache: Record<string, PortalTask[]>;
  detailsCache: Record<string, PortalTask>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  status: string;
  priority: string;
  jobId: string;
  customerId: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
};

const initialState: TasksState = {
  items: [],
  pagesCache: {},
  detailsCache: {},
  page: 1,
  limit: TASKS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  priority: "",
  jobId: "",
  customerId: "",
  loading: false,
  mutating: false,
  error: null,
};

export function tasksCacheKey(
  search = "",
  status = "",
  priority = "",
  jobId = "",
  customerId = "",
  page = 1,
  limit = TASKS_DEFAULT_LIMIT,
) {
  return `${status}|${priority}|${jobId}|${customerId}|${search.trim()}|${page}|${limit}`;
}

export const fetchTasks = createAsyncThunk<
  {
    items: PortalTask[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    priority: string;
    jobId: string;
    customerId: string;
  },
  {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    jobId?: string;
    customerId?: string;
    search?: string;
  } | void,
  { state: { tasks: TasksState }; rejectValue: string }
>("tasks/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().tasks ?? initialState;
  const hasParams = params !== undefined && params !== null;
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const targetStatus = hasParams && "status" in params ? (params.status || "") : state.status;
  const targetPriority = hasParams && "priority" in params ? (params.priority || "") : state.priority;
  const targetJobId = hasParams && "jobId" in params ? (params.jobId || "") : state.jobId;
  const targetCustomerId = hasParams && "customerId" in params ? (params.customerId || "") : state.customerId;
  const targetSearch = hasParams && "search" in params ? (params.search || "") : state.search;

  try {
    const result = await queryTasks({
      page: targetPage,
      limit: targetLimit,
      search: targetSearch.trim() || undefined,
      status: targetStatus.trim() || undefined,
      priority: targetPriority.trim() || undefined,
      jobId: targetJobId.trim() || undefined,
      customerId: targetCustomerId.trim() || undefined,
      force: true,
      silent: true,
    });
    return {
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      search: targetSearch,
      status: targetStatus,
      priority: targetPriority,
      jobId: targetJobId,
      customerId: targetCustomerId,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchTaskDetail = createAsyncThunk<
  PortalTask,
  string,
  { rejectValue: string }
>("tasks/fetchDetail", async (id, { rejectWithValue }) => {
  try {
    const item = await getTask(id);
    if (!item) return rejectWithValue("Task not found");
    return item;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createTaskRecord = createAsyncThunk<
  PortalTask,
  PortalTask,
  { rejectValue: string }
>("tasks/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createTask(payload);
    if (!created) return rejectWithValue("Task was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateTaskRecord = createAsyncThunk<
  PortalTask,
  { id: string; task: PortalTask },
  { rejectValue: string }
>("tasks/update", async ({ id, task }, { rejectWithValue }) => {
  try {
    const updated = await updateTask(id, task);
    if (!updated) return rejectWithValue("Task was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchTaskStatus = createAsyncThunk<
  PortalTask,
  { id: string; status: PortalTask["status"] },
  { rejectValue: string }
>("tasks/patchStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateTaskStatus(id, status);
    if (!updated) return rejectWithValue("Task status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteTaskRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("tasks/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteTask(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setTasksSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      const key = tasksCacheKey(
        state.search,
        state.status,
        state.priority,
        state.jobId,
        state.customerId,
        1,
        state.limit,
      );
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    setTasksPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = tasksCacheKey(
        state.search,
        state.status,
        state.priority,
        state.jobId,
        state.customerId,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    setTasksStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      const key = tasksCacheKey(
        state.search,
        state.status,
        state.priority,
        state.jobId,
        state.customerId,
        1,
        state.limit,
      );
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    setTasksPriority(state, action: PayloadAction<string>) {
      state.priority = action.payload;
      state.page = 1;
      const key = tasksCacheKey(
        state.search,
        state.status,
        state.priority,
        state.jobId,
        state.customerId,
        1,
        state.limit,
      );
      if (key in state.pagesCache && state.pagesCache[key].length > 0) {
        state.items = state.pagesCache[key];
        state.loading = false;
      } else {
        state.items = state.pagesCache[key] ?? [];
        state.loading = true;
      }
    },
    invalidateTasksCache(state) {
      state.pagesCache = {};
    },
    clearTasksError(state) {
      state.error = null;
    },
    upsertTaskItem(state, action: PayloadAction<PortalTask>) {
      state.pagesCache = {};
      state.detailsCache[action.payload.id] = action.payload;
      state.items = [
        action.payload,
        ...state.items.filter((item) => item.id !== action.payload.id),
      ];
      state.total = Math.max(state.total, state.items.length);
    },
    removeTaskItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      delete state.detailsCache[action.payload];
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state, action) => {
        const p = action.meta.arg;
        const hasParams = p !== undefined && p !== null;
        const targetSearch = hasParams && "search" in p ? (p.search || "") : state.search;
        const targetStatus = hasParams && "status" in p ? (p.status || "") : state.status;
        const targetPriority = hasParams && "priority" in p ? (p.priority || "") : state.priority;
        const targetJobId = hasParams && "jobId" in p ? (p.jobId || "") : state.jobId;
        const targetCustomerId = hasParams && "customerId" in p ? (p.customerId || "") : state.customerId;
        const targetPage = p?.page ?? state.page;
        const targetLimit = p?.limit ?? state.limit;
        const key = tasksCacheKey(
          targetSearch,
          targetStatus,
          targetPriority,
          targetJobId,
          targetCustomerId,
          targetPage,
          targetLimit,
        );
        state.search = targetSearch;
        state.status = targetStatus;
        state.priority = targetPriority;
        state.jobId = targetJobId;
        state.customerId = targetCustomerId;
        state.page = targetPage;
        state.limit = targetLimit;

        // If this page/tab has cached items (> 0), show them immediately without loading spinner (revalidate in background)
        if (key in state.pagesCache && state.pagesCache[key].length > 0) {
          state.items = state.pagesCache[key];
          state.loading = false;
        } else {
          // If no cached data OR cached data is empty/null, show loading spinner while API is in-flight
          state.items = state.pagesCache[key] ?? [];
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = TASKS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.priority = action.payload.priority;
        state.jobId = action.payload.jobId;
        state.customerId = action.payload.customerId;
        action.payload.items.forEach((item) => {
          state.detailsCache[item.id] = item;
        });
        state.pagesCache[
          tasksCacheKey(
            state.search,
            state.status,
            state.priority,
            state.jobId,
            state.customerId,
            state.page,
            state.limit,
          )
        ] = action.payload.items;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load tasks.";
      })
      .addCase(fetchTaskDetail.fulfilled, (state, action) => {
        const item = action.payload;
        state.detailsCache[item.id] = item;
        const index = state.items.findIndex((t) => t.id === item.id);
        if (index !== -1) {
          state.items[index] = item;
        }
      })
      .addCase(createTaskRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createTaskRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.detailsCache[action.payload.id] = action.payload;
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createTaskRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create task.";
      })
      .addCase(updateTaskRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        const updated = action.payload;
        state.detailsCache[updated.id] = updated;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(patchTaskStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        state.detailsCache[updated.id] = updated;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteTaskRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        delete state.detailsCache[action.payload];
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      // Listen by action type — avoid importing customersSlice (circular with store/index).
      .addMatcher(
        (action): action is PayloadAction<PortalTask> =>
          action.type === "customers/createTask/fulfilled",
        (state, action) => {
          state.pagesCache = {};
          state.detailsCache[action.payload.id] = action.payload;
          state.items = [
            action.payload,
            ...state.items.filter((item) => item.id !== action.payload.id),
          ];
          state.total += 1;
        },
      )
      .addMatcher(
        (action): action is PayloadAction<PortalTask> =>
          action.type === "customers/updateTask/fulfilled",
        (state, action) => {
          state.pagesCache = {};
          const updated = action.payload;
          state.detailsCache[updated.id] = updated;
          state.items = state.items.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          );
        },
      )
      .addMatcher(
        (action): action is PayloadAction<{ id: string; customerId: string }> =>
          action.type === "customers/deleteTask/fulfilled",
        (state, action) => {
          state.pagesCache = {};
          delete state.detailsCache[action.payload.id];
          state.items = state.items.filter((item) => item.id !== action.payload.id);
          state.total = Math.max(0, state.total - 1);
        },
      );
  },
});

export const {
  setTasksSearch,
  setTasksPage,
  setTasksStatus,
  setTasksPriority,
  invalidateTasksCache,
  clearTasksError,
  upsertTaskItem,
  removeTaskItemLocal,
} = tasksSlice.actions;

export default tasksSlice.reducer;
