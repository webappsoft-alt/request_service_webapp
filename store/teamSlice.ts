import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeDetail,
  queryEstimates,
  queryJobs,
  querySchedule,
  queryTasks,
  queryTeam,
  updateEmployee,
  type DeleteEmployeeResult,
} from "@/lib/api/crm-client";
import type { PortalTask } from "@/lib/data/crm-people";
import type {
  PortalCalendarEvent,
  PortalEmployee,
  PortalEmployeeActiveAssignments,
  PortalEmployeeDetail,
} from "@/lib/data/portal";
import type { Estimate, Job } from "@/lib/types";

/** List page size for GET /provider/team */
export const TEAM_DEFAULT_LIMIT = 10;
const DETAIL_TAB_LIMIT = 10;

const EMPTY_ASSIGNMENTS: PortalEmployeeActiveAssignments = {
  jobs: [],
  tasks: [],
  schedule: [],
};

type TabListState<T> = {
  employeeId: string;
  filterKey: string;
  items: T[];
  /** True after a successful GET for this employeeId + filterKey (including empty lists). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
};

function emptyTabList<T>(): TabListState<T> {
  return {
    employeeId: "",
    filterKey: "",
    items: [],
    loaded: false,
    loading: false,
    error: null,
    page: 1,
    total: 0,
    totalPages: 1,
  };
}

type TeamState = {
  items: PortalEmployee[];
  pagesCache: Record<string, PortalEmployee[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  role: string;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  detail: PortalEmployee | null;
  detailAssignments: PortalEmployeeActiveAssignments;
  detailLoading: boolean;
  detailError: string | null;
  jobs: TabListState<Job>;
  estimates: TabListState<Estimate>;
  tasks: TabListState<PortalTask>;
  schedule: TabListState<PortalCalendarEvent>;
};

const initialState: TeamState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: TEAM_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  role: "",
  loading: false,
  mutating: false,
  error: null,
  detail: null,
  detailAssignments: EMPTY_ASSIGNMENTS,
  detailLoading: false,
  detailError: null,
  jobs: emptyTabList(),
  estimates: emptyTabList(),
  tasks: emptyTabList(),
  schedule: emptyTabList(),
};

function cacheKey(search: string, role: string, page: number, limit: number) {
  return `${role}|${search.trim()}|${page}|${limit}`;
}

function tabCacheKey(arg: { status?: string; search?: string; page?: number; kind?: string }) {
  return `${arg.status?.trim() || ""}|${arg.search?.trim() || ""}|${arg.kind?.trim() || ""}|${arg.page ?? 1}`;
}

export function teamTabFilterKey(arg: {
  status?: string;
  search?: string;
  page?: number;
  kind?: string;
}) {
  return tabCacheKey(arg);
}

export function selectTeamTabShowLoader<T>(
  tab: TabListState<T> | null | undefined,
  employeeId: string,
  filterKey = "|||1",
) {
  if (!employeeId) return false;
  if (!tab) return true;
  const sameView = tab.employeeId === employeeId && tab.filterKey === filterKey;
  // Different employee/filter (or unbound) → show loader until this view binds.
  if (!sameView) return true;
  // Same as customer tabs: spinner only when empty + loading. If rows exist,
  // keep them visible while the GET refreshes in the background.
  return Boolean(tab.loading && tab.items.length === 0);
}

/** Prefer Redux tab rows whenever they belong to this employee (including empty loaded lists). */
export function selectTeamTabRows<T>(
  tab: TabListState<T> | null | undefined,
  employeeId: string,
  filterKey = "|||1",
  fallback: T[] = [],
): T[] {
  if (!tab || tab.employeeId !== employeeId) return fallback;
  if (tab.loaded && tab.filterKey === filterKey) return tab.items;
  if (tab.loading || tab.items.length > 0) return tab.items;
  return fallback;
}

function setTabPending<T>(tab: TabListState<T>, employeeId: string, filterKey: string) {
  const sameView = tab.employeeId === employeeId && tab.filterKey === filterKey;
  if (!sameView) {
    tab.items = [];
    tab.loaded = false;
  }
  // Same as customer tabs: only flip loading when there is nothing to show yet.
  if (tab.items.length === 0) {
    tab.loading = true;
  }
  tab.error = null;
  tab.employeeId = employeeId;
  tab.filterKey = filterKey;
}

function setTabFulfilled<T>(
  tab: TabListState<T>,
  payload: {
    employeeId: string;
    filterKey: string;
    items: T[];
    page?: number;
    total?: number;
    totalPages?: number;
  },
) {
  tab.loading = false;
  tab.loaded = true;
  tab.error = null;
  tab.employeeId = payload.employeeId;
  tab.filterKey = payload.filterKey;
  tab.items = payload.items;
  tab.page = payload.page ?? 1;
  tab.total = payload.total ?? payload.items.length;
  tab.totalPages = payload.totalPages ?? 1;
}

function setTabRejected<T>(tab: TabListState<T>, message: string) {
  tab.loading = false;
  tab.error = message;
}

type EmployeeTabArg = {
  employeeId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  force?: boolean;
  kind?: string;
};

function applyDetail(state: TeamState, payload: PortalEmployeeDetail) {
  const cached =
    state.items.find((item) => item.id === payload.employee.id) ??
    (state.detail?.id === payload.employee.id ? state.detail : null);
  const employee: PortalEmployee = cached
    ? {
        ...cached,
        ...payload.employee,
        email: payload.employee.email || cached.email,
        phone: payload.employee.phone || cached.phone,
        trade: payload.employee.trade || cached.trade,
        hourlyRate: payload.employee.hourlyRate ?? cached.hourlyRate,
        overtimeRate: payload.employee.overtimeRate ?? cached.overtimeRate,
        travelRate: payload.employee.travelRate ?? cached.travelRate,
        hireDate: payload.employee.hireDate ?? cached.hireDate,
        emergencyName: payload.employee.emergencyName ?? cached.emergencyName,
        emergencyPhone: payload.employee.emergencyPhone ?? cached.emergencyPhone,
        workingHours: payload.employee.workingHours ?? cached.workingHours,
      }
    : payload.employee;
  state.detail = employee;
  state.detailAssignments = payload.activeAssignments;
  state.detailLoading = false;
  state.detailError = null;
  state.items = state.items.map((item) =>
    item.id === employee.id ? { ...item, ...employee } : item,
  );
}

export const fetchTeam = createAsyncThunk<
  {
    items: PortalEmployee[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    search: string;
    role: string;
  },
  { force?: boolean; limit?: number; page?: number; search?: string; role?: string } | void,
  { state: { team: TeamState }; rejectValue: string }
>("team/fetchList", async (params, { getState, rejectWithValue }) => {
  const state = getState().team ?? initialState;
  try {
    const page = params && typeof params === "object" && params.page !== undefined ? params.page : state.page;
    const limit =
      params && typeof params === "object" && params.limit !== undefined
        ? params.limit
        : params && typeof params === "object" && params.force
          ? 100
          : state.limit;
    const search =
      params && typeof params === "object" && params.search !== undefined ? params.search : state.search;
    const role = params && typeof params === "object" && params.role !== undefined ? params.role : state.role;
    const result = await queryTeam({
      page,
      limit,
      search: search.trim() || undefined,
      role: role.trim() || undefined,
      force: true,
      silent: true,
    });
    return {
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      search,
      role,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

/** GET /api/provider/team/:id — profile + activeAssignments. */
export const fetchTeamMember = createAsyncThunk<
  PortalEmployeeDetail,
  string,
  { rejectValue: string }
>("team/fetchMember", async (id, { rejectWithValue }) => {
  try {
    const detail = await getEmployeeDetail(id);
    if (!detail) return rejectWithValue("Employee not found.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createTeamMember = createAsyncThunk<
  PortalEmployee,
  Parameters<typeof createEmployee>[0],
  { rejectValue: string }
>("team/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createEmployee(payload);
    if (!created) return rejectWithValue("Employee was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateTeamMember = createAsyncThunk<
  PortalEmployeeDetail,
  { id: string; patch: Partial<PortalEmployee> },
  { rejectValue: string }
>("team/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    await updateEmployee(id, patch);
    const detail = await getEmployeeDetail(id);
    if (!detail) return rejectWithValue("Employee was updated but could not be read.");
    return detail;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteTeamMember = createAsyncThunk<
  DeleteEmployeeResult & { id: string },
  string,
  { rejectValue: string }
>("team/delete", async (id, { rejectWithValue }) => {
  try {
    return await deleteEmployee(id);
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchEmployeeJobs = createAsyncThunk<
  { employeeId: string; filterKey: string; items: Job[]; page: number; total: number; totalPages: number },
  EmployeeTabArg,
  { state: { team: TeamState }; rejectValue: string }
>("team/fetchJobs", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const result = await queryJobs({
      employeeId: arg.employeeId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      employeeId: arg.employeeId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchEmployeeEstimates = createAsyncThunk<
  {
    employeeId: string;
    filterKey: string;
    items: Estimate[];
    page: number;
    total: number;
    totalPages: number;
  },
  EmployeeTabArg,
  { state: { team: TeamState }; rejectValue: string }
>("team/fetchEstimates", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    // Manual wants ?employeeId=; backend list schema does not support it yet.
    // Fetch page and filter by siteVisit.employeeId on the client until BE adds the filter.
    const result = await queryEstimates({
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    const items = result.items.filter(
      (item) => String(item.siteVisit?.employeeId || "").trim() === arg.employeeId,
    );
    return {
      employeeId: arg.employeeId,
      filterKey,
      items,
      page: result.page,
      total: items.length,
      totalPages: 1,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchEmployeeTasks = createAsyncThunk<
  {
    employeeId: string;
    filterKey: string;
    items: PortalTask[];
    page: number;
    total: number;
    totalPages: number;
  },
  EmployeeTabArg,
  { state: { team: TeamState }; rejectValue: string }
>("team/fetchTasks", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    // Backend filter is assignedEmployeeId (manual documents employeeId).
    const result = await queryTasks({
      assignedEmployeeId: arg.employeeId,
      status: arg.status || undefined,
      search: arg.search || undefined,
      page: arg.page ?? 1,
      limit: arg.limit ?? DETAIL_TAB_LIMIT,
      force: true,
      silent: true,
    });
    return {
      employeeId: arg.employeeId,
      filterKey,
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const fetchEmployeeSchedule = createAsyncThunk<
  { employeeId: string; filterKey: string; items: PortalCalendarEvent[] },
  EmployeeTabArg,
  { state: { team: TeamState }; rejectValue: string }
>("team/fetchSchedule", async (arg, { rejectWithValue }) => {
  const filterKey = tabCacheKey(arg);
  try {
    const items = await querySchedule({
      employeeId: arg.employeeId,
      kind: arg.kind || undefined,
      force: true,
      silent: true,
    });
    return {
      employeeId: arg.employeeId,
      filterKey,
      items,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const teamSlice = createSlice({
  name: "team",
  initialState,
  reducers: {
    setTeamSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setTeamPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(state.search, state.role, state.page, state.limit);
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setTeamRole(state, action: PayloadAction<string>) {
      state.role = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    invalidateTeamCache(state) {
      state.pagesCache = {};
    },
    clearTeamError(state) {
      state.error = null;
    },
    clearTeamDetail(state) {
      state.detail = null;
      state.detailAssignments = EMPTY_ASSIGNMENTS;
      state.detailError = null;
      state.detailLoading = false;
      state.jobs = emptyTabList();
      state.estimates = emptyTabList();
      state.tasks = emptyTabList();
      state.schedule = emptyTabList();
    },
    /** Drop tab caches that do not belong to this employee (employee switch). */
    bindTeamDetailEmployee(state, action: PayloadAction<string>) {
      const employeeId = action.payload;
      if (state.jobs.employeeId && state.jobs.employeeId !== employeeId) {
        state.jobs = emptyTabList();
      }
      if (state.estimates.employeeId && state.estimates.employeeId !== employeeId) {
        state.estimates = emptyTabList();
      }
      if (state.tasks.employeeId && state.tasks.employeeId !== employeeId) {
        state.tasks = emptyTabList();
      }
      if (state.schedule.employeeId && state.schedule.employeeId !== employeeId) {
        state.schedule = emptyTabList();
      }
    },
    upsertEmployeeTask(state, action: PayloadAction<{ employeeId: string; item: PortalTask }>) {
      const { employeeId, item } = action.payload;
      if (state.tasks.loaded && state.tasks.employeeId === employeeId) {
        const index = state.tasks.items.findIndex((row) => row.id === item.id);
        if (index >= 0) state.tasks.items[index] = item;
        else {
          state.tasks.items = [item, ...state.tasks.items];
          state.tasks.total += 1;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeam.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = TEAM_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.role = action.payload.role;
        state.pagesCache[cacheKey(state.search, state.role, state.page, state.limit)] =
          action.payload.items;
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load employees.";
      })
      .addCase(fetchTeamMember.pending, (state, action) => {
        const nextId = action.meta.arg;
        const previousId = state.detail?.id;
        state.detailLoading = true;
        state.detailError = null;
        // Switching employees must never reuse the previous employee's tab caches.
        if (previousId && previousId !== nextId) {
          state.jobs = emptyTabList();
          state.estimates = emptyTabList();
          state.tasks = emptyTabList();
          state.schedule = emptyTabList();
        } else if (!previousId) {
          if (state.jobs.employeeId && state.jobs.employeeId !== nextId) state.jobs = emptyTabList();
          if (state.estimates.employeeId && state.estimates.employeeId !== nextId) {
            state.estimates = emptyTabList();
          }
          if (state.tasks.employeeId && state.tasks.employeeId !== nextId) state.tasks = emptyTabList();
          if (state.schedule.employeeId && state.schedule.employeeId !== nextId) {
            state.schedule = emptyTabList();
          }
        }
      })
      .addCase(fetchTeamMember.fulfilled, (state, action) => {
        applyDetail(state, action.payload);
      })
      .addCase(fetchTeamMember.rejected, (state, action) => {
        state.detailLoading = false;
        state.detailError = action.payload || "Failed to load employee.";
      })
      .addCase(createTeamMember.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(createTeamMember.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createTeamMember.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create employee.";
      })
      .addCase(updateTeamMember.pending, (state) => {
        state.mutating = true;
        state.error = null;
      })
      .addCase(updateTeamMember.fulfilled, (state, action) => {
        state.mutating = false;
        applyDetail(state, action.payload);
      })
      .addCase(updateTeamMember.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to update employee.";
      })
      .addCase(deleteTeamMember.fulfilled, (state, action) => {
        state.pagesCache = {};
        const id = action.payload.id;
        state.items = state.items.filter((item) => item.id !== id);
        state.total = Math.max(0, state.total - 1);
        if (state.detail?.id === id) {
          state.detail = null;
          state.detailAssignments = EMPTY_ASSIGNMENTS;
        }
      })
      .addCase(fetchEmployeeJobs.pending, (state, action) => {
        setTabPending(state.jobs, action.meta.arg.employeeId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchEmployeeJobs.fulfilled, (state, action) => {
        setTabFulfilled(state.jobs, action.payload);
      })
      .addCase(fetchEmployeeJobs.rejected, (state, action) => {
        setTabRejected(state.jobs, action.payload || "Failed to load jobs.");
      })
      .addCase(fetchEmployeeEstimates.pending, (state, action) => {
        setTabPending(state.estimates, action.meta.arg.employeeId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchEmployeeEstimates.fulfilled, (state, action) => {
        setTabFulfilled(state.estimates, action.payload);
      })
      .addCase(fetchEmployeeEstimates.rejected, (state, action) => {
        setTabRejected(state.estimates, action.payload || "Failed to load estimates.");
      })
      .addCase(fetchEmployeeTasks.pending, (state, action) => {
        setTabPending(state.tasks, action.meta.arg.employeeId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchEmployeeTasks.fulfilled, (state, action) => {
        setTabFulfilled(state.tasks, action.payload);
      })
      .addCase(fetchEmployeeTasks.rejected, (state, action) => {
        setTabRejected(state.tasks, action.payload || "Failed to load tasks.");
      })
      .addCase(fetchEmployeeSchedule.pending, (state, action) => {
        setTabPending(state.schedule, action.meta.arg.employeeId, tabCacheKey(action.meta.arg));
      })
      .addCase(fetchEmployeeSchedule.fulfilled, (state, action) => {
        setTabFulfilled(state.schedule, action.payload);
      })
      .addCase(fetchEmployeeSchedule.rejected, (state, action) => {
        setTabRejected(state.schedule, action.payload || "Failed to load schedule.");
      });
  },
});

export const {
  setTeamSearch,
  setTeamPage,
  setTeamRole,
  invalidateTeamCache,
  clearTeamError,
  clearTeamDetail,
  bindTeamDetailEmployee,
  upsertEmployeeTask,
} = teamSlice.actions;

export default teamSlice.reducer;
