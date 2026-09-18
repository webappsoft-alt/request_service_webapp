import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeDetail,
  queryTeam,
  updateEmployee,
} from "@/lib/api/crm-client";
import type {
  PortalEmployee,
  PortalEmployeeActiveAssignments,
  PortalEmployeeDetail,
} from "@/lib/data/portal";

/** List page size for GET /provider/team */
export const TEAM_DEFAULT_LIMIT = 10;

const EMPTY_ASSIGNMENTS: PortalEmployeeActiveAssignments = {
  jobs: [],
  tasks: [],
  schedule: [],
};

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
};

function cacheKey(search: string, role: string, page: number, limit: number) {
  return `${role}|${search.trim()}|${page}|${limit}`;
}

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
    const limit = params && typeof params === "object" && params.limit !== undefined ? params.limit : (params && typeof params === "object" && params.force ? 100 : state.limit);
    const search = params && typeof params === "object" && params.search !== undefined ? params.search : state.search;
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

export const deleteTeamMember = createAsyncThunk<string, string, { rejectValue: string }>(
  "team/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteEmployee(id);
      return id;
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error));
    }
  },
);

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
        state.pagesCache[
          cacheKey(state.search, state.role, state.page, state.limit)
        ] = action.payload.items;
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load employees.";
      })
      .addCase(fetchTeamMember.pending, (state) => {
        state.detailLoading = true;
        state.detailError = null;
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
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        if (state.detail?.id === action.payload) {
          state.detail = null;
          state.detailAssignments = EMPTY_ASSIGNMENTS;
        }
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
} = teamSlice.actions;

export default teamSlice.reducer;
