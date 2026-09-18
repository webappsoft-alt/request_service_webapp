import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createTask,
  deleteTask,
  queryTasks,
  updateTask,
  updateTaskStatus,
} from "@/lib/api/crm-client";
import type { PortalTask } from "@/lib/data/crm-people";
import {
  createCustomerTask,
  updateCustomerTask,
  deleteCustomerTask,
} from "./customersSlice";

/** List page size for GET /provider/tasks */
export const TASKS_DEFAULT_LIMIT = 10;

type TasksState = {
  items: PortalTask[];
  pagesCache: Record<string, PortalTask[]>;
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

function cacheKey(
  search: string,
  status: string,
  priority: string,
  jobId: string,
  customerId: string,
  page: number,
  limit: number,
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
  const targetPage = params?.page ?? state.page;
  const targetLimit = params?.limit ?? state.limit;
  const targetStatus = params?.status !== undefined ? params.status : state.status;
  const targetPriority = params?.priority !== undefined ? params.priority : state.priority;
  const targetJobId = params?.jobId !== undefined ? params.jobId : state.jobId;
  const targetCustomerId = params?.customerId !== undefined ? params.customerId : state.customerId;
  const targetSearch = params?.search !== undefined ? params.search : state.search;

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
      state.pagesCache = {};
    },
    setTasksPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(
        state.search,
        state.status,
        state.priority,
        state.jobId,
        state.customerId,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setTasksStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setTasksPriority(state, action: PayloadAction<string>) {
      state.priority = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateTasksCache(state) {
      state.pagesCache = {};
    },
    clearTasksError(state) {
      state.error = null;
    },
    upsertTaskItem(state, action: PayloadAction<PortalTask>) {
      state.pagesCache = {};
      state.items = [
        action.payload,
        ...state.items.filter((item) => item.id !== action.payload.id),
      ];
      state.total = Math.max(state.total, state.items.length);
    },
    removeTaskItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
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
        state.pagesCache[
          cacheKey(
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
      .addCase(createTaskRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createTaskRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
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
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(patchTaskStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteTaskRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(createCustomerTask.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(updateCustomerTask.fulfilled, (state, action) => {
        state.pagesCache = {};
        const updated = action.payload;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteCustomerTask.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload.id);
        state.total = Math.max(0, state.total - 1);
      });
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
