import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { extractErrorMessage } from "@/components/api/extractErrorMessage";
import {
  createReminder,
  deleteReminder,
  queryReminders,
  updateReminder,
  updateReminderArchive,
  updateReminderStatus,
} from "@/lib/api/crm-client";
import type { PortalReminder } from "@/lib/data/crm-people";
import { deleteCustomerReminder } from "./customersSlice";

/** List page size for GET /provider/reminders */
export const REMINDERS_DEFAULT_LIMIT = 20;

export type ReminderListFilter = "" | "open" | "done" | "overdue" | "archived";

type RemindersState = {
  items: PortalReminder[];
  pagesCache: Record<string, PortalReminder[]>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  search: string;
  /** Lifecycle / overdue filter — empty means all active statuses. */
  status: string;
  /** Soft-archive list mode. */
  isArchived: boolean;
  loading: boolean;
  mutating: boolean;
  error: string | null;
};

const initialState: RemindersState = {
  items: [],
  pagesCache: {},
  page: 1,
  limit: REMINDERS_DEFAULT_LIMIT,
  total: 0,
  totalPages: 1,
  search: "",
  status: "",
  isArchived: false,
  loading: false,
  mutating: false,
  error: null,
};

function cacheKey(
  search: string,
  status: string,
  isArchived: boolean,
  page: number,
  limit: number,
) {
  return `${isArchived ? "archived" : "active"}|${status}|${search.trim()}|${page}|${limit}`;
}

export const fetchReminders = createAsyncThunk<
  {
    items: PortalReminder[];
    page: number;
    total: number;
    totalPages: number;
    search: string;
    status: string;
    isArchived: boolean;
  },
  void,
  { state: { reminders: RemindersState }; rejectValue: string }
>("reminders/fetchList", async (_params, { getState, rejectWithValue }) => {
  const state = getState().reminders ?? initialState;
  try {
    const result = await queryReminders({
      page: state.page,
      limit: state.limit,
      search: state.search.trim() || undefined,
      status: state.status.trim() || undefined,
      isArchived: state.isArchived,
      force: true,
      silent: true,
    });
    return {
      items: result.items,
      page: result.page,
      total: result.total,
      totalPages: result.totalPages,
      search: state.search,
      status: state.status,
      isArchived: state.isArchived,
    };
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const createReminderRecord = createAsyncThunk<
  PortalReminder,
  PortalReminder,
  { rejectValue: string }
>("reminders/create", async (payload, { rejectWithValue }) => {
  try {
    const created = await createReminder(payload);
    if (!created) return rejectWithValue("Reminder was created but could not be read.");
    return created;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const updateReminderRecord = createAsyncThunk<
  PortalReminder,
  { id: string; reminder: PortalReminder },
  { rejectValue: string }
>("reminders/update", async ({ id, reminder }, { rejectWithValue }) => {
  try {
    const updated = await updateReminder(id, reminder);
    if (!updated) return rejectWithValue("Reminder was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchReminderStatus = createAsyncThunk<
  PortalReminder,
  { id: string; status: PortalReminder["status"] },
  { rejectValue: string }
>("reminders/patchStatus", async ({ id, status }, { rejectWithValue }) => {
  try {
    const updated = await updateReminderStatus(id, status);
    if (!updated) return rejectWithValue("Reminder status was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const patchReminderArchive = createAsyncThunk<
  PortalReminder,
  { id: string; isArchived: boolean },
  { rejectValue: string }
>("reminders/patchArchive", async ({ id, isArchived }, { rejectWithValue }) => {
  try {
    const updated = await updateReminderArchive(id, isArchived);
    if (!updated) return rejectWithValue("Reminder archive was updated but could not be read.");
    return updated;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

export const deleteReminderRecord = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>("reminders/delete", async (id, { rejectWithValue }) => {
  try {
    await deleteReminder(id);
    return id;
  } catch (error) {
    return rejectWithValue(extractErrorMessage(error));
  }
});

const remindersSlice = createSlice({
  name: "reminders",
  initialState,
  reducers: {
    setRemindersSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setRemindersPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
      const key = cacheKey(
        state.search,
        state.status,
        state.isArchived,
        state.page,
        state.limit,
      );
      if (key in state.pagesCache) state.items = state.pagesCache[key];
    },
    setRemindersStatus(state, action: PayloadAction<string>) {
      state.status = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    setRemindersArchived(state, action: PayloadAction<boolean>) {
      state.isArchived = action.payload;
      state.page = 1;
      state.pagesCache = {};
    },
    /** Apply list filter from URL / dropdown: all | open | done | overdue | archived */
    setRemindersListFilter(state, action: PayloadAction<ReminderListFilter>) {
      const filter = action.payload;
      state.page = 1;
      state.pagesCache = {};
      if (filter === "archived") {
        state.isArchived = true;
        state.status = "";
        return;
      }
      state.isArchived = false;
      state.status = filter === "" ? "" : filter;
    },
    invalidateRemindersCache(state) {
      state.pagesCache = {};
    },
    clearRemindersError(state) {
      state.error = null;
    },
    upsertReminderItem(state, action: PayloadAction<PortalReminder>) {
      state.pagesCache = {};
      state.items = [
        action.payload,
        ...state.items.filter((item) => item.id !== action.payload.id),
      ];
      state.total = Math.max(state.total, state.items.length);
    },
    removeReminderItemLocal(state, action: PayloadAction<string>) {
      state.pagesCache = {};
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.total = Math.max(0, state.total - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReminders.pending, (state) => {
        if (state.items.length === 0) state.loading = true;
        state.error = null;
      })
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.page = action.payload.page;
        state.limit = REMINDERS_DEFAULT_LIMIT;
        state.total = action.payload.total;
        state.totalPages = Math.max(1, action.payload.totalPages);
        state.search = action.payload.search;
        state.status = action.payload.status;
        state.isArchived = action.payload.isArchived;
        state.pagesCache[
          cacheKey(
            state.search,
            state.status,
            state.isArchived,
            state.page,
            state.limit,
          )
        ] = action.payload.items;
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load reminders.";
      })
      .addCase(createReminderRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(createReminderRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        if (state.isArchived) return;
        state.page = 1;
        state.items = [
          action.payload,
          ...state.items.filter((item) => item.id !== action.payload.id),
        ];
        state.total += 1;
      })
      .addCase(createReminderRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to create reminder.";
      })
      .addCase(updateReminderRecord.pending, (state) => {
        state.mutating = true;
      })
      .addCase(updateReminderRecord.fulfilled, (state, action) => {
        state.mutating = false;
        state.pagesCache = {};
        const updated = action.payload;
        const matchesArchive = Boolean(updated.isArchived) === state.isArchived;
        if (!matchesArchive) {
          state.items = state.items.filter((item) => item.id !== updated.id);
          state.total = Math.max(0, state.total - 1);
          return;
        }
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(updateReminderRecord.rejected, (state, action) => {
        state.mutating = false;
        state.error = action.payload || "Failed to update reminder.";
      })
      .addCase(patchReminderStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const matchesStatus =
          !state.status ||
          state.status === "overdue" ||
          updated.status === state.status;
        if (!matchesStatus && !state.isArchived) {
          state.pagesCache = {};
          state.items = state.items.filter((item) => item.id !== updated.id);
          state.total = Math.max(0, state.total - 1);
          return;
        }
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(patchReminderArchive.fulfilled, (state, action) => {
        state.pagesCache = {};
        const updated = action.payload;
        const matchesArchive = Boolean(updated.isArchived) === state.isArchived;
        if (!matchesArchive) {
          state.items = state.items.filter((item) => item.id !== updated.id);
          state.total = Math.max(0, state.total - 1);
          return;
        }
        state.items = state.items.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        );
      })
      .addCase(deleteReminderRecord.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(deleteCustomerReminder.fulfilled, (state, action) => {
        state.pagesCache = {};
        state.items = state.items.filter((item) => item.id !== action.payload.id);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const {
  setRemindersSearch,
  setRemindersPage,
  setRemindersStatus,
  setRemindersArchived,
  setRemindersListFilter,
  invalidateRemindersCache,
  clearRemindersError,
  upsertReminderItem,
  removeReminderItemLocal,
} = remindersSlice.actions;

export default remindersSlice.reducer;
