import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/apiFuntions";
import {
  createEmployee,
  deleteEmployee,
  queryTeam,
  updateEmployee,
} from "@/lib/api/crm-client";
import type { PortalEmployee } from "@/lib/data/portal";

/** List page size for GET /provider/team */
export const TEAM_DEFAULT_LIMIT = 10;

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
};

function cacheKey(search: string, role: string, page: number, limit: number) {
  return `${role}|${search.trim()}|${page}|${limit}`;
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
  PortalEmployee,
  { id: string; patch: Partial<PortalEmployee> },
  { rejectValue: string }
>("team/update", async ({ id, patch }, { rejectWithValue }) => {
  try {
    const updated = await updateEmployee(id, patch);
    if (!updated) return rejectWithValue("Employee was updated but could not be read.");
    return updated;
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
      .addCase(updateTeamMember.fulfilled, (state, action) => {
        const updated = action.payload;
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteTeamMember.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const {
  setTeamSearch,
  setTeamPage,
  setTeamRole,
  invalidateTeamCache,
  clearTeamError,
} = teamSlice.actions;

export default teamSlice.reducer;
